import type { ReactNode } from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Circle } from "react-native-svg";
import { palette } from "@theme/colors";
import { IcBike, IcMapPin } from "./icons";
import { Press } from "./Press";
const c = palette.dark;

/** Compact brand signature shared by the working screens. */
export function PageHeading({
  title,
  eyebrow,
  subtitle,
  icon,
  action,
}: {
  title: string;
  eyebrow: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <View style={s.heading}>
      <View style={s.brandLine}>
        <View style={s.brandDot} />
        <Text style={s.brand}>
          COMANDPOS{" "}
          <Text style={{ color: c.textMuted, fontWeight: "600" }}>
            {" "}
            / DELIVERY
          </Text>
        </Text>
        {action && <View style={{ marginLeft: "auto" }}>{action}</View>}
      </View>
      <View style={s.titleRow}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={s.eyebrow}>{eyebrow}</Text>
          <Text style={s.title}>{title}</Text>
        </View>
        {icon && <View style={s.headingIcon}>{icon}</View>}
      </View>
      {!!subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
    </View>
  );
}

export function JourneyOverview({
  name,
  location,
  pickup,
  transit,
  incidents,
  known,
}: {
  name: string;
  location: string;
  pickup: number;
  transit: number;
  incidents: number;
  known: boolean;
}) {
  return (
    <LinearGradient
      colors={["#7C2D12", "#B94810", "#E76816"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={s.journey}
    >
      <View pointerEvents="none" style={s.ring} />
      <View
        pointerEvents="none"
        style={[s.ring, { width: 145, height: 145, right: -5, top: -68 }]}
      />
      <View
        style={{ position: "absolute", right: 5, top: 14, opacity: 0.25 }}
        pointerEvents="none"
      >
        <RouteArt width={125} />
      </View>
      <View style={s.journeyTop}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={s.journeyKicker}>TU JORNADA</Text>
          <Text style={s.greeting}>Hola, {name}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <IcMapPin size={12} color="#FFDAB8" />
            <Text style={s.location} numberOfLines={1}>
              {location}
            </Text>
          </View>
        </View>
        <View style={s.bikeDisc}>
          <IcBike size={28} color="#FFF3E7" />
        </View>
      </View>
      <View style={s.stats}>
        {[
          { value: pickup, label: "Por recoger" },
          { value: transit, label: "En camino" },
          { value: incidents, label: "Incidencias" },
        ].map((item, i) => (
          <View key={item.label} style={[s.stat, i > 0 && s.statBorder]}>
            <Text style={s.statValue}>{known ? item.value : "—"}</Text>
            <Text style={s.statLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
    </LinearGradient>
  );
}

export function SectionLabel({
  title,
  caption,
  icon,
}: {
  title: string;
  caption?: string;
  icon?: ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        marginTop: 3,
      }}
    >
      {icon && <View style={s.sectionIcon}>{icon}</View>}
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={s.sectionTitle}>{title}</Text>
        {caption && <Text style={s.subtitle}>{caption}</Text>}
      </View>
    </View>
  );
}

/** Code-native illustration: route, parcel and destination, matching the orange brand. */
export function RouteArt({ width = 160 }: { width?: number }) {
  return (
    <Svg
      width={width}
      height={width * 0.7}
      viewBox="0 0 200 140"
      fill="none"
      accessibilityElementsHidden
    >
      <Circle cx="100" cy="73" r="57" fill="#FFF0DE" />
      <Circle cx="160" cy="33" r="12" fill="#FDE4C7" />
      <Path
        d="M23 111H77C123 111 94 72 137 72H162"
        stroke="#E9BA8E"
        strokeWidth="2"
        strokeDasharray="4 6"
        strokeLinecap="round"
      />
      <Circle cx="24" cy="111" r="5" fill="#EA580C" />
      <Path
        d="M160 31C147 31 137 41 137 53C137 69 160 86 160 86S183 69 183 53C183 41 173 31 160 31Z"
        fill="#EA580C"
      />
      <Circle cx="160" cy="53" r="7" fill="#FFF5E9" />
      <Path
        d="M55 54L89 37L123 54V92L89 112L55 92V54Z"
        fill="#FFFFFF"
        stroke="#A74816"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <Path
        d="M55 54L89 74L123 54M89 74V112M72 46L106 65V78"
        stroke="#A74816"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <Path
        d="M65 81L77 88M65 87L73 92"
        stroke="#ECAA72"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Circle cx="43" cy="37" r="3" fill="#F9AC62" />
      <Path
        d="M129 19V27M125 23H133"
        stroke="#DDA168"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function ProfileCard({
  name,
  username,
  location,
  initials,
}: {
  name: string;
  username?: string;
  location: string;
  initials: string;
}) {
  return (
    <LinearGradient
      colors={["#28201B", "#493024"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={s.profile}
    >
      <View
        pointerEvents="none"
        style={[s.ring, { top: -100, right: -45, borderColor: "#FFFFFF0C" }]}
      />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 15 }}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{initials}</Text>
          <View style={s.avatarMark}>
            <IcBike size={13} color="#fff" />
          </View>
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={s.profileName}>{name}</Text>
          <Text style={s.profileRole}>
            {username ? `@${username} · ` : ""}REPARTIDOR
          </Text>
        </View>
      </View>
      <View style={s.profileBranch}>
        <IcMapPin size={16} color="#FFBA80" />
        <Text style={{ fontSize: 13, color: "#F3E7DD", flex: 1 }}>
          {location}
        </Text>
        <Text style={{ fontSize: 10, color: "#CDB39F", fontWeight: "700" }}>
          SUCURSAL
        </Text>
      </View>
    </LinearGradient>
  );
}

export function IconAction({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Press accessibilityLabel={label} onPress={onPress} style={s.iconAction}>
      {children}
    </Press>
  );
}
const s = StyleSheet.create({
  heading: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 17, gap: 7 },
  brandLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 25,
  },
  brandDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: c.brandMid,
  },
  brand: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.4,
    color: c.brandDeep,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 6,
  },
  eyebrow: { fontSize: 11, color: c.textDim, fontWeight: "600" },
  title: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -1.2,
    color: c.text,
  },
  subtitle: { fontSize: 12, lineHeight: 18, color: c.textDim },
  headingIcon: {
    height: 47,
    width: 47,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9EBDE",
    borderWidth: 1,
    borderColor: "#F2DDC9",
  },
  journey: {
    borderRadius: 25,
    padding: 20,
    overflow: "hidden",
    gap: 21,
    shadowColor: "#7C2D12",
    shadowOpacity: 0.13,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  ring: {
    position: "absolute",
    width: 230,
    height: 230,
    borderRadius: 120,
    borderWidth: 1,
    borderColor: "#FFFFFF15",
    right: -62,
    top: -110,
  },
  journeyTop: { flexDirection: "row", alignItems: "center", gap: 15 },
  journeyKicker: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2,
    color: "#FFD6AE",
  },
  greeting: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.6,
    color: "#FFF",
  },
  location: { fontSize: 12, color: "#FFDEC0", flexShrink: 1 },
  bikeDisc: {
    width: 57,
    height: 57,
    borderRadius: 20,
    backgroundColor: "#FFFFFF14",
    borderWidth: 1,
    borderColor: "#FFFFFF26",
    alignItems: "center",
    justifyContent: "center",
  },
  stats: {
    flexDirection: "row",
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#FFFFFF26",
  },
  stat: { flex: 1, gap: 3, paddingLeft: 14 },
  statBorder: { borderLeftWidth: 1, borderLeftColor: "#FFFFFF26" },
  statValue: {
    fontSize: 25,
    fontWeight: "800",
    color: "#FFF",
    fontVariant: ["tabular-nums"],
  },
  statLabel: { fontSize: 11, fontWeight: "600", color: "#FFE3C8" },
  sectionIcon: {
    height: 36,
    width: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.primaryDim,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: c.text,
    letterSpacing: -0.35,
  },
  profile: { borderRadius: 24, padding: 22, gap: 22, overflow: "hidden" },
  avatar: {
    height: 61,
    width: 61,
    borderRadius: 21,
    backgroundColor: "#FEE2C4",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 23, fontWeight: "800", color: "#7C2D12" },
  avatarMark: {
    position: "absolute",
    bottom: -3,
    right: -3,
    width: 24,
    height: 24,
    borderRadius: 9,
    backgroundColor: "#DF631E",
    borderWidth: 3,
    borderColor: "#37261F",
    alignItems: "center",
    justifyContent: "center",
  },
  profileName: {
    fontSize: 21,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.6,
  },
  profileRole: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    color: "#D5BEAD",
  },
  profileBranch: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#FFFFFF16",
  },
  iconAction: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#ECE5DD",
    shadowColor: "#302016",
    shadowOpacity: 0.09,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
  },
});
