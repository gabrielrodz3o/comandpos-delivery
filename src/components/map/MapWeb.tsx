import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Press } from "@components/ui/Press";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { palette } from "@theme/colors";

const c = palette.dark;

/** Una parada tal como se dibuja en el mapa (estado ya resuelto en RN). */
export interface SceneStop {
  id: number;
  lat: number;
  lng: number;
  label: string; // número de parada
  color: string; // hex del pin
  size: number; // diámetro base (30 normal, 38 seleccionado)
  halo?: boolean; // anillo "próxima entrega"
  dim?: boolean; // atenuado (no elegido en selectMode)
  check?: boolean; // muestra check en vez del número
}

export interface MapScene {
  center: { lat: number; lng: number };
  stops: SceneStop[];
  me: { lat: number; lng: number } | null;
  line: { lat: number; lng: number }[] | null;
  dashed: boolean; // true = trazo recto (fallback), false = ruta por calles
  padding?: { top: number; right: number; bottom: number; left: number };
}

export interface MapWebHandle {
  /** Encua­dra todas las paradas + mi ubicación. */
  fit: () => void;
}

interface Props {
  /** Key de Google Maps de la unidad de negocio (runtime, por tenant). */
  apiKey: string | null;
  scene: MapScene;
  /** Estilo de mapa (mismo JSON que customMapStyle de react-native-maps). */
  mapStyle: unknown;
  /** Color de la polyline (primario de marca). */
  primary?: string;
  onMarkerPress: (id: number) => void;
  onMapPress: () => void;
}

/**
 * Mapa basado en WebView + Google Maps JavaScript API. A diferencia del SDK
 * nativo (`react-native-maps` con PROVIDER_GOOGLE, key fija en build-time),
 * aquí la key se inyecta en runtime, así **cada unidad de negocio usa su propia
 * key** también para los tiles. La UI inferior (tarjetas/botones) vive en RN.
 *
 * Requisito en Google Cloud de cada tenant: habilitar **Maps JavaScript API**
 * (además de Directions API que ya usa el ruteo). La key no puede llevar
 * restricción de app Android (esa es solo para el SDK nativo); usar sin
 * restricción o por referer del `baseUrl`.
 */
const MapWeb = forwardRef<MapWebHandle, Props>(function MapWeb(
  { apiKey, scene, mapStyle, primary = c.primary, onMarkerPress, onMapPress },
  ref,
) {
  const webRef = useRef<WebView>(null);
  const ready = useRef(false);
  const [failure, setFailure] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    ready.current = false;
    setFailure(false);
    setLoaded(false);
    const timeout = setTimeout(() => {
      if (!ready.current) setFailure(true);
    }, 20000);
    return () => clearTimeout(timeout);
  }, [apiKey, attempt]);
  const lastScene = useRef<MapScene>(scene);
  lastScene.current = scene;

  useImperativeHandle(ref, () => ({
    fit: () =>
      webRef.current?.injectJavaScript("window.__fit && window.__fit();true;"),
  }));

  const html = useMemo(
    () => (apiKey ? buildHtml(apiKey, mapStyle, primary) : ""),
    [apiKey, mapStyle, primary],
  );

  // Re-inyecta la escena cuando cambia (sin recargar el WebView).
  const sceneJson = useMemo(() => JSON.stringify(scene), [scene]);
  useEffect(() => {
    if (!ready.current) return;
    webRef.current?.injectJavaScript(`window.__setScene(${sceneJson});true;`);
  }, [sceneJson]);

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: { type?: string; id?: number };
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === "ready") {
      ready.current = true;
      setLoaded(true);
      setFailure(false);
      // primer dibujado + encuadre inicial
      webRef.current?.injectJavaScript(
        `window.__setScene(${JSON.stringify(lastScene.current)});window.__fit&&window.__fit();true;`,
      );
    } else if (msg.type === "authError") {
      setFailure(true);
    } else if (msg.type === "markerPress" && typeof msg.id === "number") {
      onMarkerPress(msg.id);
    } else if (msg.type === "mapPress") {
      onMapPress();
    }
  };

  if (!apiKey) {
    // Sin key del tenant no hay mapa JS; fondo neutro (la UI inferior sigue).
    return (
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.fallback,
          { justifyContent: "center", alignItems: "center", padding: 24 },
        ]}
      >
        <Text style={{ color: c.textDim, textAlign: "center" }}>
          Mapa no disponible para esta sucursal. Tus entregas siguen disponibles
          debajo.
        </Text>
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <WebView
        key={`${apiKey}:${attempt}`}
        ref={webRef}
        style={StyleSheet.absoluteFill}
        originWhitelist={["*"]}
        source={{ html, baseUrl: "https://localhost/" }}
        onMessage={onMessage}
        onError={() => setFailure(true)}
        onHttpError={() => setFailure(true)}
        javaScriptEnabled
        domStorageEnabled
        androidLayerType="hardware"
        scrollEnabled={false}
        overScrollMode="never"
        setBuiltInZoomControls={false}
        allowsInlineMediaPlayback
      />
      {(!loaded || failure) && (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.fallback,
            {
              justifyContent: "center",
              alignItems: "center",
              padding: 24,
              gap: 12,
            },
          ]}
        >
          {failure ? (
            <>
              <Text style={{ color: c.textDim, textAlign: "center" }}>
                No se pudo cargar el mapa. Revisa la conexión o consulta a caja.
              </Text>
              <Press
                style={{ padding: 12 }}
                onPress={() => setAttempt((n) => n + 1)}
              >
                <Text style={{ color: c.brandMid, fontWeight: "800" }}>
                  Reintentar mapa
                </Text>
              </Press>
            </>
          ) : (
            <>
              <ActivityIndicator color={c.brandMid} />
              <Text style={{ color: c.textDim }}>Cargando mapa…</Text>
            </>
          )}
        </View>
      )}
    </View>
  );
});

export default MapWeb;

const styles = StyleSheet.create({
  fallback: { backgroundColor: "#f7f4ef" },
});

/** HTML estático del mapa. La escena (markers/ruta/yo) se inyecta luego. */
function buildHtml(apiKey: string, mapStyle: unknown, primary: string): string {
  const style = JSON.stringify(mapStyle ?? []);
  const key = encodeURIComponent(apiKey);
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>html,body,#map{height:100%;margin:0;padding:0;background:#f7f4ef}</style>
</head>
<body>
<div id="map"></div>
<script>
var PRIMARY = ${JSON.stringify(primary)};
var MAP_STYLE = ${style};
var map, markers = [], meMarker = null, routeLine = null, fittedSignature = null;
var sceneRef = null;

function post(o){ try{ window.ReactNativeWebView.postMessage(JSON.stringify(o)); }catch(e){} }

function pinIcon(s){
  var size = s.size || 30, pad = s.halo ? 6 : 0, border = 2.5, tip = 8;
  var W = size + pad*2, cx = W/2, cy = pad + size/2, R = size/2, H = pad + size + tip;
  var halo = s.halo ? '<circle cx="'+cx+'" cy="'+cy+'" r="'+(R+pad-1)+'" fill="'+PRIMARY+'33" stroke="'+PRIMARY+'66" stroke-width="1"/>' : '';
  var tri = '<path d="M'+(cx-5)+' '+(pad+size-2)+' L'+cx+' '+(pad+size+tip-2)+' L'+(cx+5)+' '+(pad+size-2)+' Z" fill="'+s.color+'"/>';
  var inner = s.check
    ? '<path d="M'+(cx-size*0.2)+' '+(cy+size*0.02)+' l '+(size*0.14)+' '+(size*0.16)+' l '+(size*0.28)+' '+(-size*0.3)+'" fill="none" stroke="#fff" stroke-width="'+(size*0.13)+'" stroke-linecap="round" stroke-linejoin="round"/>'
    : '<text x="'+cx+'" y="'+(cy+size*0.16)+'" font-size="'+(size*0.46)+'" font-weight="900" fill="#fff" text-anchor="middle" font-family="Arial,Helvetica,sans-serif">'+s.label+'</text>';
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'">'
    + '<g opacity="'+(s.dim?0.5:1)+'">'+halo+tri
    + '<circle cx="'+cx+'" cy="'+cy+'" r="'+R+'" fill="'+s.color+'" stroke="#fff" stroke-width="'+border+'"/>'
    + inner + '</g></svg>';
  return { url:'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg), scaledSize:new google.maps.Size(W,H), anchor:new google.maps.Point(cx,H) };
}

function meIcon(){
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">'
    + '<circle cx="13" cy="13" r="12" fill="#2563EB22"/>'
    + '<circle cx="13" cy="13" r="6" fill="#2563EB" stroke="#fff" stroke-width="2.5"/></svg>';
  return { url:'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg), scaledSize:new google.maps.Size(26,26), anchor:new google.maps.Point(13,13) };
}

window.__setScene = function(s){
  sceneRef = s;
  if(!map) return;
  // markers
  for(var i=0;i<markers.length;i++) markers[i].setMap(null);
  markers = [];
  (s.stops||[]).forEach(function(st){
    var m = new google.maps.Marker({ position:{lat:st.lat,lng:st.lng}, map:map, icon:pinIcon(st), zIndex: st.size>30?999:1 });
    m.addListener('click', function(){ post({type:'markerPress', id:st.id}); });
    markers.push(m);
  });
  // yo
  if(meMarker){ meMarker.setMap(null); meMarker=null; }
  if(s.me){ meMarker = new google.maps.Marker({ position:{lat:s.me.lat,lng:s.me.lng}, map:map, icon:meIcon(), zIndex:0 }); }
  // ruta
  if(routeLine){ routeLine.setMap(null); routeLine=null; }
  if(s.line && s.line.length>1){
    var path = s.line.map(function(p){ return {lat:p.lat,lng:p.lng}; });
    routeLine = new google.maps.Polyline({
      path:path, map:map, geodesic:!!s.dashed,
      strokeColor:PRIMARY, strokeOpacity: s.dashed?0:1, strokeWeight:4.5,
      icons: s.dashed ? [{icon:{path:'M 0,-1 0,1', strokeOpacity:1, strokeWeight:4.5, scale:2.2}, offset:'0', repeat:'13px'}] : undefined
    });
  }
  var signature = (s.stops||[]).map(function(p){return p.id+':'+p.lat+':'+p.lng}).join('|') + (s.me?'|me':'');
  if(signature && signature !== fittedSignature){ fittedSignature=signature; window.__fit(); }
};

window.__fit = function(){
  if(!map || !sceneRef) return;
  var pts = (sceneRef.stops||[]).map(function(s){ return {lat:s.lat,lng:s.lng}; });
  if(sceneRef.me) pts.push(sceneRef.me);
  if(!pts.length) return;
  var padding = sceneRef.padding || {top:90,right:60,bottom:80,left:60};
  if(pts.length===1){ map.setCenter(pts[0]); map.setZoom(15); map.panBy(0,(padding.bottom-padding.top)/2); return; }
  var b = new google.maps.LatLngBounds();
  pts.forEach(function(p){ b.extend(p); });
  map.fitBounds(b, padding);
};

var resizeTimer;
window.addEventListener('resize', function(){
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(function(){ window.__fit(); }, 150);
});

window.__init = function(){
  var c0 = (sceneRef && sceneRef.center) || {lat:19.4517,lng:-70.697};
  map = new google.maps.Map(document.getElementById('map'), {
    center:c0, zoom:13, disableDefaultUI:true, clickableIcons:false,
    gestureHandling:'greedy', styles:MAP_STYLE, backgroundColor:'#f7f4ef'
  });
  map.addListener('click', function(){ post({type:'mapPress'}); });
  post({type:'ready'});
};

window.gm_authFailure = function(){ post({type:'authError'}); };
</script>
<script async defer src="https://maps.googleapis.com/maps/api/js?key=${key}&callback=__init"></script>
</body>
</html>`;
}
