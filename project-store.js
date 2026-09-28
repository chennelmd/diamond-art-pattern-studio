(function attachProjectStore(root) {
  const DATABASE_NAME = 'diamond-art-pattern-studio';
  const STORE_NAME = 'projects';
  const DATABASE_VERSION = 1;

  function normalizeProject(project) {
    if (!project || !project.id || !project.name || !project.pattern) throw new TypeError('A project id, name, and pattern are required.');
    const now = new Date().toISOString();
    return {
      ...project,
      id: String(project.id),
      name: String(project.name).trim() || 'Untitled pattern',
      createdAt: project.createdAt || now,
      updatedAt: project.updatedAt || now,
      version: 1,
    };
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!root.indexedDB) return reject(new Error('Local project storage is unavailable in this browser.'));
      const request = root.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Local project storage could not be opened.'));
    });
  }

  async function transact(mode, action) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      let request;
      try { request = action(store); } catch (error) { database.close(); reject(error); return; }
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('The project operation failed.'));
      transaction.oncomplete = () => database.close();
      transaction.onerror = () => { database.close(); reject(transaction.error || new Error('The project operation failed.')); };
    });
  }

  function save(project) { return transact('readwrite', store => store.put(normalizeProject(project))); }
  function get(id) { return transact('readonly', store => store.get(id)); }
  function remove(id) { return transact('readwrite', store => store.delete(id)); }
  async function list() {
    const projects = await transact('readonly', store => store.getAll());
    return projects.sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
  }

  root.PatternProjects = { normalizeProject, save, get, remove, list };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PatternProjects;
})(typeof globalThis !== 'undefined' ? globalThis : window);
