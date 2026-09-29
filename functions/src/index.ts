import * as admin from 'firebase-admin';

admin.initializeApp();

export { broadcastIncident } from './broadcastIncident';
export { onIncidentCreated } from './onIncidentCreated';
export { onVoteCreated } from './onVoteCreated';
export { reapExpiredIncidents } from './reapExpiredIncidents';
export { deleteUserData } from './deleteUserData';
