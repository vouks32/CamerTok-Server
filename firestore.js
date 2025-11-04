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
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const r2 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});



// Configuration Firebase
const firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID,
    measurementId: process.env.REACT_APP_MEASUREMENT_ID
};

// Initialiser Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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

// Construct a query with where, limit, and orderBy
const query = () => {
    const conditions = [];
    let limitCount = null;
    let orderByField = null;
    let orderDirection = 'asc';

    // Methods to add conditions
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

// Upload vers R2
const uploadFile = async (fileBuffer, filePath, mimeType) => {
    await r2.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: filePath,
        Body: fileBuffer,
        ContentType: mimeType,
    }));

    // Générer une URL temporaire de 1h
    const url = await getSignedUrl(r2, new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: filePath,
    }), { expiresIn: 3600 });

    return url;
};



// Upload vers R2
const GetUploadLink = async (filePath) => {
    const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: filePath
    });

    return await getSignedUrl(r2, command, { expiresIn: 3600 }); // 1 hour
};

// Obtenir une URL de téléchargement temporaire
const getFileUrl = async (filePath) => {
    return await getSignedUrl(r2, new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: filePath,
    }), { expiresIn: 3600 });
};

// Retourne le contenu complet du fichier en Buffer
const getFileBuffer = async (filePath) => {
    const command = new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: filePath,
    });

    const response = await r2.send(command); 

    // response.Body est un stream
    const chunks = [];
    for await (const chunk of response.Body) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks); // retourne le fichier complet en Buffer
};

// Supprimer un fichier
const deleteFile = async (filePath) => {
    await r2.send(new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: filePath,
    }));
};


export {
    createCollection,
    addDoc,
    updateDoc,
    getDoc,
    getDocs,
    query,
    uploadFile,
    getFileUrl,
    getFileBuffer,
    deleteFile,
    GetUploadLink
}