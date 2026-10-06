import { create } from 'zustand';
import { Incident, IncidentGeoJsonCollection, IncidentGeoJsonFeature } from '../types';
import { moderationService, FlagReason } from '../services/moderationService';

interface IncidentState {
  incidents: Record<string, Incident>;
  geoJsonFeatures: IncidentGeoJsonCollection;
  selectedIncidentId: string | null;
  flaggedIncidentIds: Record<string, boolean>;
  
  // Actions
  initModeration: () => Promise<void>;
  setIncidents: (incidents: Incident[]) => void;
  addIncident: (incident: Incident) => void;
  removeIncident: (id: string) => void;
  flagIncident: (id: string, userId?: string, reason?: FlagReason) => Promise<boolean>;
  updateIncidentVotes: (id: string, upvotes: number, downvotes: number) => void;
  selectIncident: (id: string | null) => void;
}

const buildGeoJson = (incidentsMap: Record<string, Incident>): IncidentGeoJsonCollection => {
  const features: IncidentGeoJsonFeature[] = Object.values(incidentsMap)
    .filter((inc) => inc.active)
    .map((inc) => ({
      type: 'Feature',
      id: inc.id,
      geometry: {
        type: 'Point',
        coordinates: [inc.location.longitude, inc.location.latitude],
      },
      properties: {
        id: inc.id,
        category: inc.category,
        description: inc.description,
        mediaUrl: inc.mediaUrl,
        mediaType: inc.mediaType,
        thumbnailUrl: inc.thumbnailUrl,
        timestamp: inc.timestamp,
        upvotes: inc.upvotes,
        downvotes: inc.downvotes,
      },
    }));

  return {
    type: 'FeatureCollection',
    features,
  };
};

export const useIncidentStore = create<IncidentState>((set, get) => ({
  incidents: {},
  geoJsonFeatures: {
    type: 'FeatureCollection',
    features: [],
  },
  selectedIncidentId: null,
  flaggedIncidentIds: {},

  initModeration: async () => {
    const ids = await moderationService.init();
    const map: Record<string, boolean> = {};
    for (const id of ids) {
      map[id] = true;
    }
    set({ flaggedIncidentIds: map });
  },

  setIncidents: (incidentList) => {
    const flagged = get().flaggedIncidentIds;
    const map: Record<string, Incident> = {};
    for (const inc of incidentList) {
      if (!flagged[inc.id] && !moderationService.isFlagged(inc.id)) {
        map[inc.id] = inc;
      }
    }
    set({
      incidents: map,
      geoJsonFeatures: buildGeoJson(map),
    });
  },

  addIncident: (incident) => {
    if (get().flaggedIncidentIds[incident.id] || moderationService.isFlagged(incident.id)) {
      return;
    }
    const current = { ...get().incidents, [incident.id]: incident };
    set({
      incidents: current,
      geoJsonFeatures: buildGeoJson(current),
    });
  },

  removeIncident: (id) => {
    const current = { ...get().incidents };
    delete current[id];
    set({
      incidents: current,
      geoJsonFeatures: buildGeoJson(current),
      selectedIncidentId: get().selectedIncidentId === id ? null : get().selectedIncidentId,
    });
  },

  flagIncident: async (id, userId = 'anonymous', reason = 'other') => {
    // 1. Submit to moderation service & persist
    const success = await moderationService.flagIncident(id, userId, reason);

    // 2. Optimistically remove from state and register flagged ID
    const current = { ...get().incidents };
    delete current[id];

    set({
      incidents: current,
      geoJsonFeatures: buildGeoJson(current),
      flaggedIncidentIds: { ...get().flaggedIncidentIds, [id]: true },
      selectedIncidentId: get().selectedIncidentId === id ? null : get().selectedIncidentId,
    });

    return success;
  },

  updateIncidentVotes: (id, upvotes, downvotes) => {
    const current = get().incidents;
    const target = current[id];
    if (!target) return;
    const updated = {
      ...current,
      [id]: {
        ...target,
        upvotes,
        downvotes,
      },
    };
    set({
      incidents: updated,
      geoJsonFeatures: buildGeoJson(updated),
    });
  },

  selectIncident: (id) => {
    set({ selectedIncidentId: id });
  },
}));

