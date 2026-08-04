"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Map as MaplibreMap, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapPin } from "lucide-react";
import { useLocationStore } from "@/lib/store";

const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

export default function LocationPage() {
  const router = useRouter();
  const stored = useLocationStore();
  const setLocation = useLocationStore((s) => s.setLocation);

  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [address, setAddress] = useState(stored.address);
  const [coords, setCoords] = useState({ lat: stored.lat, lng: stored.lng });
  const [resolving, setResolving] = useState(false);
  const [bounce, setBounce] = useState(false);
  const [tilesLoaded, setTilesLoaded] = useState(false);
  const [showSkip, setShowSkip] = useState(false);

  // Never block entry into the app on geocoding/tiles (docs/edgecases.md #25, #28)
  useEffect(() => {
    const t = setTimeout(() => setShowSkip(true), 3000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    let initial = { lat: stored.lat, lng: stored.lng };
    // Best-effort geolocation; permission denial silently keeps the stored
    // default (docs/edgecases.md #27) — never prompts an error state.
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          map.setCenter([pos.coords.longitude, pos.coords.latitude]);
        },
        () => {},
        { timeout: 2500 }
      );
    }

    const map = new MaplibreMap({
      container: mapContainer.current,
      style: OSM_STYLE,
      center: [initial.lng, initial.lat],
      zoom: 15,
      attributionControl: false,
    });
    mapRef.current = map;

    map.on("load", () => setTilesLoaded(true));

    map.on("moveend", () => {
      const c = map.getCenter();
      setCoords({ lat: c.lat, lng: c.lng });
      setBounce(true);
      setTimeout(() => setBounce(false), 350);

      if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
      geocodeTimer.current = setTimeout(() => reverseGeocode(c.lat, c.lng), 600);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function reverseGeocode(lat: number, lng: number) {
    setResolving(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
      );
      if (!res.ok) throw new Error("geocode failed");
      const data = await res.json();
      setAddress(data.display_name ?? "Selected location");
    } catch {
      // Nominatim slow/failing never blocks Confirm (docs/edgecases.md #25)
      setAddress("Selected location");
    } finally {
      setResolving(false);
    }
  }

  function confirm() {
    setLocation(address, coords.lat, coords.lng);
    router.push("/");
  }

  return (
    <div className="relative h-[100dvh] w-full">
      <div ref={mapContainer} className="absolute inset-0" />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-8">
        <MapPin
          size={36}
          className={`text-[var(--im-orange)] drop-shadow-md transition-transform ${bounce ? "-translate-y-2" : "translate-y-0"}`}
          fill="var(--im-orange)"
          strokeWidth={1.5}
        />
      </div>

      {!tilesLoaded && showSkip && (
        <button
          type="button"
          onClick={confirm}
          className="absolute top-4 right-4 bg-white text-[12px] font-semibold text-[var(--ink-700)] px-3 py-1.5 rounded-[var(--r-pill)] shadow"
        >
          Use default address
        </button>
      )}

      <div className="absolute left-1/2 bottom-0 w-full max-w-[480px] -translate-x-1/2 bg-white rounded-t-[var(--r-lg)] p-4">
        <p className="text-[11px] font-semibold text-[var(--ink-500)] uppercase tracking-wide mb-1">
          Delivering to
        </p>
        <p className="text-[13px] text-[var(--ink-900)] font-medium min-h-[18px]">
          {resolving ? "Locating…" : address}
        </p>
        <button
          type="button"
          onClick={confirm}
          className="mt-3 w-full h-12 bg-[var(--im-orange)] text-white rounded-[var(--r-md)] font-bold text-[14px]"
        >
          Confirm location
        </button>
      </div>
    </div>
  );
}
