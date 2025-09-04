import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'

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

// Define the file where data will be saved
const DBFile = new JSONFile('../db/DB.json')
const DB = new Low(DBFile, {})

// Read data from file (or set defaults if file doesn't exist)
await DB.read()

if (Object.keys(DB.data).length == 0)
    DB.data = {
        users: {},
        campaigns: {},
        transactions: {}
    }

// Create new collection with optional initial document
const createCollection = async (collection_id, initialDoc = null) => {
    // Check if collection already exists
    if (DB.data[collection_id] !== undefined) {
        return {
            success: true,
            collection: DB.data[collection_id],
            initialDocId: initialDoc?.id || null
        };
    }

    // Initialize empty collection
    DB.data[collection_id] = {};

    // Add initial document if provided
    if (initialDoc) {
        const { id, ...data } = initialDoc;
        DB.data[collection_id][id] = data;
    }

    await DB.write();
    return {
        success: true,
        collection: collection_id,
        initialDocId: initialDoc?.id || null
    };
}

const addDoc = async (collection_id, document_id, data) => {
    // Create collection if it doesn't exist
    if (!DB.data[collection_id]) {
        DB.data[collection_id] = {};
    }

    DB.data[collection_id][document_id] = data;
    await DB.write();
    return { ...data };
}

const updateDoc = async (collection_id, document_id, data) => {
    if (!DB.data[collection_id]?.[document_id]) {
        return false;
    }

    DB.data[collection_id][document_id] = deepMerge({ ...DB.data[collection_id][document_id] }, { ...data });
    await DB.write();
    return { ...DB.data[collection_id][document_id] };
}

const getDoc = async (collection_id, document_id) => {
    const doc = DB.data[collection_id]?.[document_id];
    if (!doc) {
        return false;
    }
    return { ...doc };
}

const getDocs = async (collection_id, query = null) => {
    if (!DB.data[collection_id]) {
        return {
            docs: [],
            empty: true,
            forEach: (callback) => [],
            size: 0
        };
    }

    let docs = Object.entries(DB.data[collection_id])
        .map(([id, data]) => ({ ...data, id }));

    if (query) {
        docs = query.execute(docs);
    }

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

    const execute = (docs) => {
        // Apply filtering
        let results = docs.filter(doc => {
            return conditions.every(condition => {
                const { field, operator, value } = condition;
                const docValue = doc[field];

                switch (operator) {
                    case '==': return docValue === value;
                    case '!=': return docValue !== value;
                    case '<': return docValue < value;
                    case '<=': return docValue <= value;
                    case '>': return docValue > value;
                    case '>=': return docValue >= value;
                    case 'array-contains':
                        return Array.isArray(docValue) && docValue.includes(value);
                    case 'in':
                        return Array.isArray(value) && value.includes(docValue);
                    case 'not-in':
                        return Array.isArray(value) && !value.includes(docValue);
                    default: return false;
                }
            });
        });

        // Apply sorting
        if (orderByField) {
            results.sort((a, b) => {
                const aValue = a[orderByField];
                const bValue = b[orderByField];

                if (aValue === bValue) return 0;
                if (aValue === undefined) return 1;
                if (bValue === undefined) return -1;

                const comparison = aValue > bValue ? 1 : -1;
                return orderDirection === 'asc' ? comparison : -comparison;
            });
        }

        // Apply limit
        if (limitCount !== null) {
            results = results.slice(0, limitCount);
        }

        return results;
    };

    const builder = {
        where,
        limit,
        orderBy,
        execute
    };

    return builder;
}


export { createCollection, addDoc, updateDoc, getDoc, getDocs, query }