"use client";
import { memo, useEffect, useRef } from 'react';
import type { City, CityOption } from './types';
import { colorForScore, scoreFor } from './ratings';
const escapeMapText = (value: string) => value.replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]!));
function InteractiveMap({
  cities,
  wishlist,
  selected,
  onSelect,
  scoreCategory
}: {
  cities: City[];
  wishlist: CityOption[];
  selected: City | null;
  onSelect: (city: City | null) => void;
  scoreCategory: string;
}) {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<import("leaflet").Map | null>(null);
  const markerLayer = useRef<import("leaflet").LayerGroup | null>(null);
  const cityMarkers = useRef(new Map<City["id"], import("leaflet").Marker>());
  const selectedRef = useRef(selected);
  const onSelectRef = useRef(onSelect);
  selectedRef.current = selected;
  onSelectRef.current = onSelect;

  useEffect(() => {
    let cancelled = false;

    async function createMap() {
      if (!mapElement.current || mapInstance.current) return;
      const L = await import("leaflet");
      if (cancelled || !mapElement.current) return;

      const map = L.map(mapElement.current, {
        center: selected ? [selected.lat, selected.lng] : [22, 8],
        zoom: selected ? 6 : 2,
        minZoom: 2,
        maxZoom: 18,
        zoomControl: false,
        markerZoomAnimation: false,
        worldCopyJump: true,
        preferCanvas: true
      });

      L.control.zoom({ position: "topright" }).addTo(map);
      const cartoKey = process.env.NEXT_PUBLIC_CARTO_BASEMAP_API_KEY;
      const osmTiles = () => L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      });
      if (cartoKey) {
        mapElement.current.dataset.basemap = "positron";
        const positronTiles = L.tileLayer(
          `https://basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png?key=${encodeURIComponent(cartoKey)}`,
          {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attribution/">CARTO</a>',
            maxZoom: 20
          }
        ).addTo(map);
        let tileErrors = 0;
        positronTiles.on("tileerror", () => {
          if (++tileErrors < 3 || !mapElement.current) return;
          positronTiles.off("tileerror");
          map.removeLayer(positronTiles);
          mapElement.current.dataset.basemap = "osm";
          osmTiles().addTo(map);
        });
      } else {
        mapElement.current.dataset.basemap = "osm";
        osmTiles().addTo(map);
      }

      const layer = L.layerGroup().addTo(map);
      mapInstance.current = map;
      markerLayer.current = layer;

      const updateZoomDetail = () => {
        if (mapElement.current) {
          const zoom = map.getZoom();
          mapElement.current.dataset.cityZoom = zoom >= 8 ? "true" : "false";
          mapElement.current.dataset.markerScale = zoom <= 3 ? "world" : zoom <= 5 ? "regional" : zoom <= 7 ? "local" : "street";
        }
      };
      map.on("zoomend", updateZoomDetail);
      map.on("click", () => onSelectRef.current(null));
      updateZoomDetail();
    }

    createMap();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout>;

    async function drawMarkers() {
      if (cancelled) return;
      const map = mapInstance.current;
      const layer = markerLayer.current;
      if (!map || !layer) {
        retry = setTimeout(drawMarkers, 40);
        return;
      }

      const L = await import("leaflet");
      if (cancelled) return;
      layer.clearLayers();
      cityMarkers.current.clear();

      cities.forEach(city => {
        const isSelected = selectedRef.current?.id === city.id;
        const displayScore = scoreFor(city, scoreCategory);
        if (displayScore === null) return;
        const icon = L.divIcon({
          className: "city-div-icon",
          html: `<div class="city-map-marker${isSelected ? " is-selected" : ""}" style="--marker-color:${colorForScore(displayScore)}">
            <span class="city-marker-label">${escapeMapText(city.name)}</span>
          </div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        });

        const marker = L.marker([city.lat, city.lng], {
          icon,
          title: `${city.name}, ${displayScore.toFixed(1)} stars`,
          riseOnHover: true
        }).addTo(layer);
        cityMarkers.current.set(city.id, marker);

        marker.bindTooltip(
          `<strong>${escapeMapText(city.name)}</strong><br>${escapeMapText(city.country)} · ${displayScore.toFixed(1)}/5 ${scoreCategory.toLowerCase()}`,
          { direction: "top", offset: [0, -18], className: "city-tooltip" }
        );
        marker.on("click", () => {
          onSelectRef.current(city);
          if (map.getZoom() < 6) map.flyTo([city.lat, city.lng], 6, { duration: 0.8 });
        });
      });

      wishlist.forEach(city => {
        const icon = L.divIcon({
          className: "city-div-icon",
          html: `<div class="city-map-marker wishlist-marker"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 27.5 4.8 16.7C-1.1 10.9 3.3 2.7 10.1 3.2c2.6.2 4.7 1.6 5.9 3.8 1.2-2.2 3.3-3.6 5.9-3.8 6.8-.5 11.2 7.7 5.3 13.5L16 27.5Z"/></svg><span class="city-marker-label">${escapeMapText(city.name)}</span></div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        });
        L.marker([city.lat, city.lng], { icon, title: city.name, riseOnHover: true })
          .bindTooltip(`<strong>${escapeMapText(city.name)}</strong><br>${escapeMapText(city.country)}`, { direction: "top", offset: [0, -13], className: "city-tooltip" })
          .addTo(layer);
      });
    }

    drawMarkers();
    return () => { cancelled = true; clearTimeout(retry); };
  }, [cities, wishlist, scoreCategory]);

  useEffect(() => {
    // Selection only changes a class, not every Leaflet marker and event handler.
    for (const [id, marker] of cityMarkers.current) {
      marker.getElement()?.querySelector(".city-map-marker")?.classList.toggle("is-selected", id === selected?.id);
    }
  }, [selected?.id]);

  useEffect(() => () => {
    mapInstance.current?.remove();
    mapInstance.current = null;
  }, []);

  return <div ref={mapElement} className="leaflet-map" aria-label="Interactive map of your rated cities" />;
}
export default memo(InteractiveMap);
