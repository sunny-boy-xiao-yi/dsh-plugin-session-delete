window.__ModuleLoader__.load({
  id: 'dsh-plugin-session-delete',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const primitives = require('@deepseek-ai/dsh-client-ui-primitives');

    const NS = 'session-delete';
    const zh = {
      'menu.delete': '删除会话',
      'dialog.title': '删除会话？',
      'dialog.desc': '“{name}”将被永久删除，本地会话记录与投影缓存也会一并移除。',
      'dialog.warning': '此操作不可恢复。如果该会话仍在运行，会先停止它的所有工作。',
      'dialog.sessionId': 'Session ID',
      'dialog.close': '关闭',
      'dialog.cancel': '取消',
      'dialog.confirm': '删除',
      'dialog.pending': '正在删除…',
      'dialog.failed': '删除失败：{reason}',
    };
    const en = {
      'menu.delete': 'Delete session',
      'dialog.title': 'Delete this session?',
      'dialog.desc': '“{name}” will be permanently deleted, including its local session data and projection cache.',
      'dialog.warning': 'This cannot be undone. If the session is still running, its work is stopped first.',
      'dialog.sessionId': 'Session ID',
      'dialog.close': 'Close',
      'dialog.cancel': 'Cancel',
      'dialog.confirm': 'Delete',
      'dialog.pending': 'Deleting…',
      'dialog.failed': 'Delete failed: {reason}',
    };

    const STYLE_ID = 'dsh-plugin-session-delete-style';
    const STYLE_TEXT = [
      '@keyframes dsh-session-delete-spin{to{transform:rotate(360deg)}}',
      '.dsh-session-delete-spin{animation:dsh-session-delete-spin .9s linear infinite}',
      '.dsh-session-delete-danger:not(:disabled){color:var(--dsw-alias-state-error-primary)}',
    ].join('');

    const styles = {
      body: { display: 'flex', flexDirection: 'column', gap: '10px' },
      warning: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        margin: 0,
        padding: '10px 12px',
        borderRadius: 'var(--dsw-radius-md)',
        background: 'var(--dsw-alias-state-warn-tertiary)',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: '12px',
        lineHeight: '18px',
      },
      warningIcon: {
        flex: '0 0 auto',
        marginTop: '1px',
        color: 'var(--dsw-alias-state-warn-primary)',
      },
      sessionId: {
        display: 'flex',
        alignItems: 'baseline',
        gap: '6px',
        margin: 0,
        fontSize: '12px',
        lineHeight: '18px',
        color: 'var(--dsw-alias-label-tertiary)',
      },
      sessionIdValue: {
        color: 'var(--dsw-alias-label-secondary)',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '11px',
        overflowWrap: 'anywhere',
      },
      status: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        margin: 0,
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: '12px',
        lineHeight: '18px',
      },
      error: {
        margin: 0,
        color: 'var(--dsw-alias-state-error-primary)',
        fontSize: '12px',
        lineHeight: '18px',
        overflowWrap: 'anywhere',
      },
    };

    function createRequestStore() {
      let value = null;
      const listeners = new Set();
      return {
        getSnapshot: () => value,
        subscribe(listener) {
          listeners.add(listener);
          return () => { listeners.delete(listener); };
        },
        set(next) {
          if (Object.is(value, next)) return;
          value = next;
          for (const listener of [...listeners]) listener();
        },
      };
    }

    function messageOf(error) {
      return error instanceof Error ? error.message : String(error);
    }

    function DeleteSessionMenuItem({ sessionId, displayTitle, useMenuOpenState, requestDelete, t }) {
      const [, setMenuOpen] = useMenuOpenState();
      return h(primitives.MenuItemButton, {
        icon: h(primitives.IconTrashOutlineRegular, { size: 14 }),
        onSelect: () => {
          setMenuOpen(false);
          requestDelete(sessionId, displayTitle);
        },
        children: t('menu.delete'),
      });
    }

    function DeleteSessionDialog({ requestStore, deleteSession, t }) {
      const request = React.useSyncExternalStore(requestStore.subscribe, requestStore.getSnapshot);
      if (request === null) return null;
      return h(DeleteSessionForm, {
        key: request.sessionId,
        request,
        requestStore,
        deleteSession,
        t,
      });
    }

    function DeleteSessionForm({ request, requestStore, deleteSession, t }) {
      const [deleting, setDeleting] = React.useState(false);
      const [error, setError] = React.useState(null);

      const close = () => {
        if (!deleting) requestStore.set(null);
      };

      const confirm = async () => {
        if (deleting) return;
        setDeleting(true);
        setError(null);
        try {
          const result = await deleteSession(request.sessionId);
          if (result?.ok !== true) {
            setDeleting(false);
            const reason = result?.error?.message || result?.error?.code || 'unknown';
            setError(t('dialog.failed', { reason }));
            return;
          }
          setDeleting(false);
          requestStore.set(null);
        } catch (reason) {
          setDeleting(false);
          setError(t('dialog.failed', { reason: messageOf(reason) }));
        }
      };

      const children = [
        h('div', { key: 'warning', style: styles.warning }, [
          h(primitives.IconWarningOutlineRegular, { key: 'icon', size: 16, style: styles.warningIcon }),
          h('span', { key: 'text' }, t('dialog.warning')),
        ]),
        h('p', { key: 'session-id', style: styles.sessionId }, [
          h('span', { key: 'label' }, t('dialog.sessionId')),
          h('code', { key: 'value', style: styles.sessionIdValue }, request.sessionId),
        ]),
      ];
      if (deleting) {
        children.push(h('p', { key: 'status', role: 'status', style: styles.status }, [
          h(primitives.IconLoadingOutlineRegular, { key: 'icon', size: 14, className: 'dsh-session-delete-spin' }),
          h('span', { key: 'text' }, t('dialog.pending')),
        ]));
      }
      if (error !== null) {
        children.push(h('p', { key: 'error', role: 'alert', style: styles.error }, error));
      }

      return h(primitives.Modal, {
        open: true,
        onClose: close,
        closeLabel: t('dialog.close'),
        title: t('dialog.title'),
        description: t('dialog.desc', { name: request.displayTitle || request.sessionId }),
        footer: [
          h(primitives.Button, {
            key: 'cancel',
            variant: 'outline',
            disabled: deleting,
            onClick: close,
          }, t('dialog.cancel')),
          h(primitives.Button, {
            key: 'delete',
            variant: 'outline',
            className: 'dsh-session-delete-danger',
            disabled: deleting,
            onClick: confirm,
          }, t('dialog.confirm')),
        ],
        children: h('div', { style: styles.body }, children),
      });
    }

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'session-delete: locales');
      ctx.effect(() => {
        if (document.getElementById(STYLE_ID) !== null) return () => {};
        const element = document.createElement('style');
        element.id = STYLE_ID;
        element.textContent = STYLE_TEXT;
        document.head.appendChild(element);
        return () => {
          if (document.getElementById(STYLE_ID) === element) element.remove();
        };
      }, 'session-delete: dialog styles');

      const requestStore = createRequestStore();

      const requestDelete = (sessionId, displayTitle) => {
        requestStore.set({ sessionId, displayTitle });
      };

      const deleteSession = async (sessionId) => {
        const result = await ctx.connection.rpc.call('/api', 'sessionTrash/deleteSession', {
          args: { sessionId },
        });
        if (result?.ok === true) {
          try { await ctx.sessions.refresh(); } catch {}
        }
        return result;
      };

      ctx.slots.inject('sidebar.workspaces.session.menu.item', function* () {
        yield ctx.slots.register({
          name: 'sidebar.workspaces.session.menu.item',
          id: 'session-delete',
          order: 500,
          locale: NS,
          inject: () => ({ requestDelete }),
        }, DeleteSessionMenuItem);
      });

      ctx.slots.inject('shell.overlay', function* () {
        yield ctx.slots.register({
          name: 'shell.overlay',
          id: 'session-delete.confirm',
          locale: NS,
          inject: () => ({ requestStore, deleteSession }),
        }, DeleteSessionDialog);
      });
    }

    return { inject: ['slots', 'locale', 'connection', 'sessions'], apply };
  },
});
