const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const backend =
  process.env.DELIVERY_BACKEND_ROOT ||
  path.resolve(__dirname, "../../../Nuxt/restaurante-comandpos");
const realBackend = path.resolve(
  __dirname,
  "../../../Nuxt/restaurante-comandpos",
);
const { createRequire } = require("node:module");
const backendRequire = createRequire(path.join(realBackend, "package.json"));
const error = (o) => Object.assign(new Error(o.statusMessage), o);
function load(relative, db, extra = {}) {
  const staged = path.join(backend, relative);
  const file = fs.existsSync(staged)
    ? staged
    : path.join(realBackend, relative);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};
  const context = {
    exports,
    require: (n) => {
      if (n === "zod") return backendRequire(n);
      if (n.endsWith("/rider-mobile-orders"))
        return load("server/utils/rider-mobile-orders.ts", db);
      if (n.endsWith("/rider-realtime")) return { emitRiderOrderUpdate() {} };
      throw Error("Missing dependency " + n);
    },
    defineEventHandler: (fn) => fn,
    dbClient: db,
    createError: error,
    getQuery: (e) => e.query || {},
    readBody: async (e) => e.body,
    Date,
    JSON,
    Math,
    Set,
    Map,
    console,
    ...extra,
  };
  vm.runInNewContext(code, context);
  return exports;
}
const event = (body = {}, query = {}) => ({
  context: { userId: 77 },
  body,
  query,
  node: { req: { io: { emit() {} } } },
});
const row = (rows) => ({ rows, rowCount: rows.length });
test("legacy availability rejects rider mutations without DB writes", async () => {
  const handler = load("server/api/restaurant/delivery/availability.post.ts", {
    query() {
      throw Error("Unexpected mutation");
    },
  }).default;
  await assert.rejects(
    handler(event({ accepting: true })),
    (e) => e.statusCode === 403,
  );
});
test("cashier controls reject authenticated rider before any operation", async () => {
  const helper = load("server/utils/rider-cashier-control.ts", {
    query: async () => row([{}]),
  });
  await assert.rejects(
    helper.assertNotRiderCashierControl(event()),
    (e) => e.statusCode === 403,
  );
});
test("mobile orders bind token owner, keep active orders without date cutoff and retain route stops", async () => {
  let sql = "",
    params;
  const db = {
    query: async (s, p) => {
      if (s.includes("SELECT accepting_orders"))
        return row([{ accepting_orders: false }]);
      sql = s;
      params = p;
      return row([]);
    },
  };
  const result = await load(
    "server/api/restaurant/delivery/my-orders.get.ts",
    db,
  ).default(event({}, { rider_use_id: 999, location_id: 3 }));
  assert.equal(params[0], 77);
  assert.equal(params[2], 3);
  assert.match(sql, /status_tracker_id IN \(3,4,5,6,12\)/);
  assert.match(sql, /OR a.delivery_route_id IN/);
  assert.equal(result.meta.accepting_orders, false);
});
test("history rejects invalid date ranges and scopes valid pagination to authenticated rider", async () => {
  let calls = [];
  const handler = load("server/api/restaurant/delivery/history.get.ts", {
    query: async (s, p) => {
      calls.push([s, p]);
      return row(Array.from({ length: 31 }, (_, id) => ({ id })));
    },
  }).default;
  await assert.rejects(
    handler(event({}, { from: "invalid", to: "2026-09-22" })),
    (e) => e.statusCode === 400,
  );
  assert.equal(calls.length, 0);
  const result = await handler(
    event(
      {},
      { from: "2026-09-01", to: "2026-09-22", offset: 30, rider_use_id: 999 },
    ),
  );
  assert.equal(calls[0][1][0], 77);
  assert.equal(result.data.length, 30);
  assert.equal(result.next_offset, 60);
  assert.match(calls[0][0], /COALESCE\(a.completed_at, history.happened_at\)/);
  assert.doesNotMatch(calls[0][0], /COALESCE\(a.completed_at,a.updated_at\)/);
});
test("finances separate customer debts, settlements, review and funds by currency", async () => {
  const params = [];
  const db = {
    query: async (s, p) => {
      params.push(p);
      return s.includes("FROM restaurant.rider_funds")
        ? row([
            { status: "open", currency_code: "DOP", amount: 500 },
            { status: "returned", currency_code: "DOP", amount: 900 },
            { status: "open", currency_code: "USD", amount: 20 },
          ])
        : row([
            { stage: "collection", currency_code: "DOP", balance: 100 },
            { stage: "settlement", currency_code: "DOP", balance: 250.25 },
            { stage: "review", currency_code: "DOP", balance: 30 },
          ]);
    },
  };
  const result = await load(
    "server/api/restaurant/delivery/my-finances.get.ts",
    db,
  ).default(event({}, { rider_use_id: 999, location_id: 3 }));
  assert.ok(params.every((p) => p[0] === 77));
  const dop = result.data.summaries.find((s) => s.currency_code === "DOP");
  assert.equal(dop.fund_to_return, 500);
  assert.equal(dop.pending_collection, 100);
  assert.equal(dop.pending_settlement, 250.25);
  assert.equal(dop.pending_review, 30);
  assert.equal(result.data.summaries.length, 2);
});
function completeDB(order) {
  const statements = [];
  const client = {
    query: async (sql, p) => {
      statements.push(sql);
      if (sql.includes("FROM restaurant.accounts a LEFT JOIN"))
        return row([order]);
      if (sql.includes("update_account_status_manual"))
        return row([{ success: true }]);
      return row([]);
    },
    release() {},
  };
  return { statements, connect: async () => client };
}
test("completion rejects another rider before updates", async () => {
  const db = completeDB({ assigned_driver_id: 88, status_tracker_id: 6 });
  await assert.rejects(
    load("server/api/restaurant/delivery/complete.post.ts", db).default(
      event({ account_id: 1 }),
    ),
    (e) => e.statusCode === 404,
  );
  assert.ok(!db.statements.some((s) => /^UPDATE/.test(s)));
  assert.ok(db.statements.includes("ROLLBACK"));
});
test("completion is idempotent and proof is required when enabled", async () => {
  let db = completeDB({ assigned_driver_id: 77, status_tracker_id: 7 });
  await load("server/api/restaurant/delivery/complete.post.ts", db).default(
    event({ account_id: 1 }),
  );
  assert.ok(
    !db.statements.some((s) => s.includes("update_account_status_manual")),
  );
  db = completeDB({
    assigned_driver_id: 77,
    status_tracker_id: 6,
    proof_required: true,
  });
  await assert.rejects(
    load("server/api/restaurant/delivery/complete.post.ts", db).default(
      event({ account_id: 1 }),
    ),
    (e) => e.statusCode === 422,
  );
  assert.ok(
    !db.statements.some((s) => s.includes("update_account_status_manual")),
  );
});
test("presence reports preserve cashier availability and replay request IDs idempotently", async () => {
  let prior = null;
  const statements = [];
  const client = {
    query: async (sql, p) => {
      statements.push(sql);
      if (sql.includes("FROM restaurant.delivery_riders r JOIN"))
        return row([
          {
            location_id: 3,
            use_fullname: "Rider",
            dispatch_status: "unavailable",
          },
        ]);
      if (sql.includes("SELECT metadata"))
        return prior ? row([{ metadata: prior }]) : row([]);
      if (sql.includes("INSERT INTO restaurant.rider_dispatch_events"))
        prior = JSON.parse(p[3]);
      return row([]);
    },
    release() {},
  };
  const handler = load(
    "server/api/restaurant/delivery/operations/presence.post.ts",
    { connect: async () => client },
  ).default;
  const e = event({ active: true, request_id: "unique-report-1" });
  await handler(e);
  await handler(e);
  assert.equal(
    statements.filter((s) => s.includes("UPDATE restaurant.delivery_riders"))
      .length,
    1,
  );
  assert.ok(
    statements
      .filter((s) => s.startsWith("UPDATE"))
      .every(
        (s) => !s.includes("accepting_orders") && !s.includes("is_active"),
      ),
  );
});

function detailedCompletionDB({
  due = 100,
  status = 6,
  rider = 77,
  currency = "DOP",
  failUpdate = false,
} = {}) {
  const statements = [];
  const client = {
    release() {},
    query: async (sql, params) => {
      statements.push({ sql, params });
      if (sql.includes("FROM restaurant.accounts a LEFT JOIN"))
        return row([
          {
            id: 1,
            location_id: 3,
            assigned_driver_id: rider,
            status_tracker_id: status,
            proof_required: true,
            delivery_route_id: 2,
          },
        ]);
      if (sql.includes("FROM restaurant.rider_collections rc"))
        return row([
          { id: "custody", amount_due: due, currency_code: currency },
        ]);
      if (sql.includes("update_account_status_manual"))
        return row([{ success: !failUpdate }]);
      return row([]);
    },
  };
  return { statements, connect: async () => client };
}
const declaration = (overrides = {}) => ({
  account_id: 1,
  recipient_name: "Cliente",
  request_id: "delivery-request-123",
  occurred_at: new Date().toISOString(),
  latitude: 18.4,
  longitude: -69.9,
  accuracy_meters: 12,
  collection: {
    cash: 80,
    card: 0,
    transfer: 0,
    other: 0,
    notes: "Cliente entregó menos efectivo",
    expected_amount: 100,
    currency_code: "DOP",
  },
  ...overrides,
});
test("partial collection stores declaration and real event time without posting payments", async () => {
  const db = detailedCompletionDB();
  const body = declaration();
  await load("server/api/restaurant/delivery/complete.post.ts", db).default(
    event(body),
  );
  const custody = db.statements.find((s) =>
    s.sql.includes("tentative_collection=$5"),
  );
  assert.equal(custody.params[2], 80);
  assert.equal(custody.params[3], 100);
  assert.equal(JSON.parse(custody.params[4]).currency_code, "DOP");
  const proof = db.statements.find((s) =>
    s.sql.includes("INSERT INTO restaurant.delivery_proofs"),
  );
  assert.equal(proof.params[4], 18.4);
  assert.equal(proof.params[7], body.occurred_at);
  assert.ok(db.statements.some((s) => s.sql === "COMMIT"));
  assert.ok(!db.statements.some((s) => /INSERT INTO finances\./.test(s.sql)));
});
test("completion rejects stale balance or currency before evidence and status writes", async () => {
  for (const options of [{ due: 150 }, { currency: "USD" }]) {
    const db = detailedCompletionDB(options);
    await assert.rejects(
      load("server/api/restaurant/delivery/complete.post.ts", db).default(
        event(declaration()),
      ),
      (e) => e.statusCode === 409,
    );
    assert.ok(!db.statements.some((s) => s.sql.startsWith("INSERT")));
    assert.ok(db.statements.some((s) => s.sql === "ROLLBACK"));
  }
});
test("collection difference requires explanation and rejects invalid monetary amounts", async () => {
  const b = declaration();
  b.collection.notes = "";
  let db = detailedCompletionDB();
  await assert.rejects(
    load("server/api/restaurant/delivery/complete.post.ts", db).default(
      event(b),
    ),
    (e) => e.statusCode === 422,
  );
  for (const cash of [-1, Infinity, 0.001]) {
    db = detailedCompletionDB();
    b.collection.cash = cash;
    await assert.rejects(
      load("server/api/restaurant/delivery/complete.post.ts", db).default(
        event(b),
      ),
      (e) => e.statusCode === 400,
    );
    assert.equal(db.statements.length, 0);
  }
});
test("failed status transition rolls back evidence and never commits collection", async () => {
  const db = detailedCompletionDB({ failUpdate: true });
  await assert.rejects(
    load("server/api/restaurant/delivery/complete.post.ts", db).default(
      event(declaration()),
    ),
    (e) => e.statusCode === 409,
  );
  assert.ok(db.statements.some((s) => s.sql === "ROLLBACK"));
  assert.ok(
    !db.statements.some(
      (s) => s.sql === "COMMIT" || s.sql.includes("tentative_collection=$5"),
    ),
  );
});
test("legacy completion never declares a payment amount on behalf of rider", async () => {
  const db = detailedCompletionDB();
  await load("server/api/restaurant/delivery/complete.post.ts", db).default(
    event({ account_id: 1, recipient_name: "Cliente" }),
  );
  assert.ok(
    !db.statements.some((s) =>
      s.sql.includes("UPDATE restaurant.rider_collections"),
    ),
  );
});
test("settlement pagination is scoped to authenticated owner and separates currencies", async () => {
  let params, sql;
  const handler = load("server/api/restaurant/delivery/my-settlements.get.ts", {
    query: async (s, p) => {
      sql = s;
      params = p;
      return row(Array.from({ length: 21 }, (_, id) => ({ id })));
    },
  }).default;
  const result = await handler(
    event({}, { offset: 20, location_id: 3, rider_use_id: 999 }),
  );
  assert.equal(params[0], 77);
  assert.equal(params[1], 3);
  assert.equal(result.data.length, 20);
  assert.equal(result.next_offset, 40);
  assert.match(sql, /GROUP BY COALESCE\(cur.code/);
  await assert.rejects(
    handler(event({}, { offset: -1 })),
    (e) => e.statusCode === 400,
  );
});
test("incident retries return same report without duplicate insert", async () => {
  let saved = null,
    insertions = 0;
  const client = {
    release() {},
    query: async (sql, p) => {
      if (sql.includes("FROM restaurant.delivery_riders"))
        return row([{ location_id: 3 }]);
      if (sql.includes("evidence->>'request_id'"))
        return row(saved ? [saved] : []);
      if (sql.includes("FROM restaurant.accounts"))
        return row([{ location_id: 4 }]);
      if (sql.includes("INSERT INTO restaurant.delivery_incidents")) {
        insertions++;
        assert.equal(p[2], 4);
        saved = { id: "incident-1", status: "open" };
        return row([saved]);
      }
      return row([]);
    },
  };
  const handler = load(
    "server/api/restaurant/delivery/incidents/index.post.ts",
    { connect: async () => client },
  ).default;
  const input = event({
    account_id: 1,
    incident_type: "customer_unreachable",
    notes: "No responde",
    request_id: "incident-request-123",
  });
  await handler(input);
  await handler(input);
  assert.equal(insertions, 1);
});
test("position cannot be reported without an active trip or with an old timestamp", async () => {
  let calls = 0;
  const handler = load("server/api/restaurant/delivery/position.post.ts", {
    query: async () => {
      calls++;
      return row([]);
    },
  }).default;
  await assert.rejects(
    handler(
      event({
        latitude: 18,
        longitude: -69,
        accuracy_meters: 10,
        recorded_at: new Date(Date.now() - 600000).toISOString(),
      }),
    ),
    (e) => e.statusCode === 422,
  );
  assert.equal(calls, 0);
  await assert.rejects(
    handler(
      event({
        latitude: 18,
        longitude: -69,
        accuracy_meters: 10,
        recorded_at: new Date().toISOString(),
      }),
    ),
    (e) => e.statusCode === 409,
  );
});
test("personal socket room rejects anonymous user IDs and uses authenticated identity", () => {
  const file = "server/plugins/socket-io.server.ts";
  const source = fs.readFileSync(
    fs.existsSync(path.join(backend, file))
      ? path.join(backend, file)
      : path.join(realBackend, file),
    "utf8",
  );
  const fn = source.slice(
    source.indexOf("    const joinUserRoom ="),
    source.indexOf("    // Auto-join si el socket"),
  );
  const code = ts.transpileModule(fn + "\njoinUserRoom(999);", {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const rooms = [],
    errors = [];
  const socket = {
    data: {},
    join: (x) => rooms.push(x),
    emit: (name) => errors.push(name),
    id: "test",
  };
  vm.runInNewContext(code, { socket, log() {}, Number });
  assert.equal(rooms.length, 0);
  assert.ok(errors.includes("join_user_error"));
  socket.data.authUserId = 77;
  vm.runInNewContext(code, { socket, log() {}, Number });
  assert.deepEqual(rooms, ["user_77"]);
});

test("arrival request replay cannot affect a later journey", async () => {
  let saved = false,
    status = "delivering",
    updates = 0;
  const client = {
    release() {},
    query: async (sql, p) => {
      if (sql.includes("FROM restaurant.delivery_riders"))
        return row([{ location_id: 3, arrival_tracking_enabled: true }]);
      if (sql.includes("metadata->>'request_id'"))
        return row(saved ? [{}] : []);
      if (sql.includes("SELECT status FROM restaurant.rider_dispatch_status"))
        return row([{ status }]);
      if (sql.includes("FROM restaurant.accounts")) return row([{ count: 0 }]);
      if (sql.includes("FROM restaurant.rider_collections"))
        return row([{ count: 1 }]);
      if (sql.includes("UPDATE restaurant.rider_dispatch_status")) {
        updates++;
        status = "awaiting_settlement";
      }
      if (sql.includes("INSERT INTO restaurant.rider_dispatch_events"))
        saved = true;
      return row([]);
    },
  };
  const handler = load(
    "server/api/restaurant/delivery/operations/arrival.post.ts",
    { connect: async () => client },
  ).default;
  await handler(event({ request_id: "arrival-request-1" }));
  status = "delivering";
  await handler(event({ request_id: "arrival-request-1" }));
  assert.equal(updates, 1);
  assert.equal(status, "delivering");
});

test("finances distinguish outstanding invoice balance from cash actually declared", async () => {
  const db = {
    query: async (sql) =>
      sql.includes("FROM restaurant.rider_funds")
        ? row([])
        : row([
            {
              stage: "settlement",
              currency_code: "DOP",
              balance: 100,
              tentative_collection: { declared_total: 80, cash: 60, card: 20 },
            },
          ]),
  };
  const result = await load(
    "server/api/restaurant/delivery/my-finances.get.ts",
    db,
  ).default(event());
  const summary = result.data.summaries[0];
  assert.equal(summary.pending_settlement, 100);
  assert.equal(summary.declared_received, 80);
  assert.equal(summary.declared_cash, 60);
});
