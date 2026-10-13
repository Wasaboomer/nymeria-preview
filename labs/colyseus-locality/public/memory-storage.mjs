// Laboratory-only adapter: the SDK Auth helper initializes storage even for guests.
// Keep its internal token cache ephemeral; never touch browser storage or game keys.
const values=new Map();
export function getItem(key,callback){callback(values.get(key));}
export function setItem(key,value){values.set(key,value);}
export function removeItem(key){values.delete(key);}
