import { lstat, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

export const name = 'session-delete';
export const inject = ['sessions'];

const SESSION_ID = /^session-[A-Za-z0-9-]{1,64}$/;
const REMOTE_METHODS = '@deepseek-ai/dsh-typert-protocol/remote-methods';

const sessionsRoot = () => join(homedir(), '.dsh', 'sessions');
const cacheRoot = () => join(homedir(), '.dsh', 'storages', 'session_projcache', 'sessions');

async function sessionDirs(id) {
  const root = sessionsRoot();
  let projects;
  try {
    projects = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const found = [];
  for (const project of projects) {
    if (!project.isDirectory()) continue;
    const dir = join(root, project.name, id);
    try {
      if ((await lstat(dir)).isDirectory()) found.push(dir);
    } catch {}
  }
  return found;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function removeSessionData(id) {
  const removedDirs = new Set();
  let failures = [];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) await delay(attempt === 1 ? 250 : 1200);
    failures = [];
    let pending = 0;
    for (const dir of await sessionDirs(id)) {
      try {
        await rm(dir, { recursive: true, force: true });
        removedDirs.add(dir);
      } catch (error) {
        pending += 1;
        failures.push(messageOf(error));
      }
    }
    await rm(join(cacheRoot(), `${id}.json`), { force: true }).catch(() => {});
    if (pending === 0) return { removed: removedDirs.size, failures: [] };
  }
  return { removed: removedDirs.size, failures };
}

function scheduleLateCleanup(id) {
  const timer = setTimeout(() => {
    void removeSessionData(id).catch(() => {});
  }, 1500);
  timer.unref?.();
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

class SessionTrashService {
  constructor(ctx) {
    this.ctx = ctx;
  }

  async deleteSession(sessionId, signal) {
    if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId)) throw new Error('非法的会话 ID');
    signal?.throwIfAborted();
    const ctx = this.ctx;
    const workspace = ctx.get('workspaceRegistry');
    let stopped = false;

    if (workspace !== undefined) {
      try {
        await workspace.archiveSession(sessionId, { stopActivity: true });
        stopped = true;
      } catch (error) {
        if (ctx.sessions.get(sessionId) !== undefined) throw new Error(`无法停止该会话的运行：${messageOf(error)}`);
      }
    }

    signal?.throwIfAborted();
    let detached = false;
    const live = ctx.sessions.get(sessionId);
    if (live !== undefined) {
      ctx.sessions.detachEntered(ctx.sessions.liveEntryFor(live));
      detached = true;
    }

    signal?.throwIfAborted();
    const { removed, failures } = await removeSessionData(sessionId);
    scheduleLateCleanup(sessionId);

    if (workspace !== undefined) {
      try {
        await workspace.unarchiveSession(sessionId);
      } catch {}
    }

    if (failures.length > 0) throw new Error(`会话目录删除未完成（稍后会自动重试）：${failures[0]}`);
    if (removed === 0 && !detached) throw new Error('没有找到该会话的本地数据（可能已被删除）');
    return { sessionId, detached, stopped, removed };
  }
}

// The Gateway discovers Remote methods from this prototype marker (the
// dependency-free equivalent of typert-protocol's decorator output).
Object.defineProperty(SessionTrashService.prototype, REMOTE_METHODS, {
  configurable: true,
  value: Object.freeze({
    version: 1,
    methods: Object.freeze([
      Object.freeze({ method: 'deleteSession', invocation: Object.freeze({ kind: 'direct' }) }),
    ]),
  }),
});

export function apply(ctx) {
  const service = new SessionTrashService(ctx);
  service.typertRemote = Object.freeze({
    service,
    serviceKey: 'sessionTrash',
    namespace: 'sessionTrash',
  });
  ctx.provide('sessionTrash', service);
}
