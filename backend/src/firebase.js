import {initializeApp,cert} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {getStorage} from 'firebase-admin/storage';
export function firebaseServices(){const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;if(!raw)throw new Error('Set FIREBASE_SERVICE_ACCOUNT_JSON on the backend. See README.md.');let account;try{account=JSON.parse(raw);}catch{throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must be valid JSON.');}const projectId=process.env.FIREBASE_PROJECT_ID||account.project_id;const bucketName=process.env.FIREBASE_STORAGE_BUCKET;if(!bucketName)throw new Error('Set FIREBASE_STORAGE_BUCKET.');initializeApp({credential:cert(account),projectId,storageBucket:bucketName});return {db:getFirestore(),auth:getAuth(),bucket:getStorage().bucket()};}
