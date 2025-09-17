import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc as getFirestoreDoc, 
  getDocs as getFirestoreDocs, 
  setDoc, 
  updateDoc as updateFirestoreDoc,
  query as firestoreQuery,
  where,
  orderBy,
  limit
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';

// Configuration Firebase
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

// Initialiser Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

/** Deep merge objects with nested objects */
function deepMerge(target, source) {
    for (const key in source) {
        if (source.hasOwnProperty(key)) {
            if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key]) && typeof target[key] === 'object' && target[key] !== null && !Array.isArray(target[key])) {
                target[key] = deepMerge(target[key] || {}, source[key]);
            } else {
                target[key] = source[key];
            }
        }
    }
    return target;
}

// Firestore functions
const createCollection = async (collection_id, initialDoc = null) => {
    if (initialDoc) {
        const { id, ...data } = initialDoc;
        await setDoc(doc(db, collection_id, id), data);
    }
    return {
        success: true,
        collection: collection_id,
        initialDocId: initialDoc?.id || null
    };
}

const addDoc = async (collection_id, document_id, data) => {
    const docRef = doc(db, collection_id, document_id);
    await setDoc(docRef, data);
    return { id: document_id, ...data };
}

const updateDoc = async (collection_id, document_id, data) => {
    const docRef = doc(db, collection_id, document_id);
    const currentDoc = await getFirestoreDoc(docRef);
    
    if (!currentDoc.exists()) {
        return false;
    }

    const mergedData = deepMerge(currentDoc.data(), data);
    await updateFirestoreDoc(docRef, mergedData);
    return { id: document_id, ...mergedData };
}

const getDoc = async (collection_id, document_id) => {
    const docSnap = await getFirestoreDoc(doc(db, collection_id, document_id));
    if (!docSnap.exists()) {
        return false;
    }
    return { id: docSnap.id, ...docSnap.data() };
}

const getDocs = async (collection_id, query = null) => {
    let q = collection(db, collection_id);
    
    if (query) {
        q = query.build(q);
    }

    const querySnapshot = await getFirestoreDocs(q);
    const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return {
        docs,
        empty: docs.length === 0,
        forEach: (callback) => docs.forEach(callback),
        size: docs.length
    };
}

const query = () => {
    const conditions = [];
    let limitCount = null;
    let orderByField = null;
    let orderDirection = 'asc';

    const where = (field, operator, value) => {
        conditions.push({ field, operator, value });
        return builder;
    };

    const limit = (count) => {
        limitCount = count;
        return builder;
    };

    const orderBy = (field, direction = 'asc') => {
        orderByField = field;
        orderDirection = direction.toLowerCase() === 'desc' ? 'desc' : 'asc';
        return builder;
    };

    const build = (collectionRef) => {
        let q = collectionRef;
        
        conditions.forEach(condition => {
            q = firestoreQuery(q, where(condition.field, condition.operator, condition.value));
        });

        if (orderByField) {
            q = firestoreQuery(q, orderBy(orderByField, orderDirection));
        }

        if (limitCount !== null) {
            q = firestoreQuery(q, limit(limitCount));
        }

        return q;
    };

    const builder = {
        where,
        limit,
        orderBy,
        build
    };

    return builder;
}

// Firebase Storage functions
const uploadFile = async (fileBuffer, filePath, mimeType) => {
    const storageRef = ref(storage, filePath);
    await uploadBytes(storageRef, fileBuffer, { contentType: mimeType });
    return await getDownloadURL(storageRef);
}

const getFileUrl = async (filePath) => {
    const storageRef = ref(storage, filePath);
    return await getDownloadURL(storageRef);
}

const deleteFile = async (filePath) => {
    const storageRef = ref(storage, filePath);
    await deleteObject(storageRef);
}

export { 
    createCollection, 
    addDoc, 
    updateDoc, 
    getDoc, 
    getDocs, 
    query, 
    uploadFile, 
    getFileUrl, 
    deleteFile 
}