window.__ModuleLoader__.load({
  id: "@blockfire/harness-web",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    let React = require("react");
    const primitives = require("@deepseek-ai/dsh-client-ui-primitives");

    /**
     * BLOCKFIRE Harness Web surface.
     *
     * Four pieces, all additive seats in the shipped slot tree (no upstream
     * file is modified, no ChatView fork):
     *
     * 1. Update Center (Settings → BLOCKFIRE) — unchanged since V1.
     * 2. Session stats strip at `conversation.input.dock` — directly below the
     *    model's activity and above the composer card. Upstream renders the
     *    same figures at `conversation.composer.dock` (below the composer);
     *    that occupant is replaced by id with a null renderer so the figures
     *    appear exactly once, next to the work instead of under the input.
     *    The velocity entry keeps the shipped TPS icon (IconClockOutline16,
     *    the icon upstream already uses for turn time / speed).
     * 3. "New session" button at `sidebar.footer.action` — a small, always
     *    visible + beside Settings; upstream's per-workspace + only appears
     *    on row hover.
     * 4. Permanent delete at `conversation.session.header.utilities` — a
     *    two-step confirm that calls the host route `POST
     *    /blockfire/session/delete`, which removes the log, the projection
     *    cache entry, and the workspace accounting through the workspace
     *    storage domain (the same facility the registry writes through), so
     *    the sidebar updates live over its own change feed.
     */

    const inject = ["slots"];
    const h = React.createElement;

    // ── shared styling (theme tokens only) ───────────────────────────────────

    const LABEL = { color: "var(--dsw-alias-label-secondary)", fontSize: 12, minWidth: 190 };
    const VALUE = { color: "var(--dsw-alias-label-primary)", fontSize: 13, wordBreak: "break-word" };
    const ROW = { display: "flex", gap: 12, padding: "6px 0", alignItems: "baseline" };
    const CARD = {
      border: "1px solid var(--dsw-alias-border-l1)",
      borderRadius: 10,
      padding: "14px 16px",
      marginBottom: 14,
      background: "var(--dsw-alias-bg-layer-1)",
    };
    const BUTTON = {
      border: "1px solid var(--dsw-alias-border-l2)",
      borderRadius: 8,
      padding: "6px 12px",
      fontSize: 13,
      cursor: "pointer",
      color: "var(--dsw-alias-label-primary)",
      background: "var(--dsw-alias-bg-layer-2)",
    };
    const CODE = {
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: 12,
      color: "var(--dsw-alias-label-primary)",
      background: "var(--dsw-alias-bg-layer-2)",
      border: "1px solid var(--dsw-alias-border-l1)",
      borderRadius: 6,
      padding: "2px 6px",
      display: "inline-block",
    };

    function row(label, value, tone) {
      const style = tone === undefined ? VALUE : Object.assign({}, VALUE, { color: tone });
      return h("div", { style: ROW, key: label }, [
        h("div", { style: LABEL, key: "l" }, label),
        h("div", { style: style, key: "v" }, value),
      ]);
    }

    // ── 1. Update Center (unchanged behavior) ────────────────────────────────

    function UpdateCenter() {
      const [state, setState] = React.useState({ phase: "loading" });
      const load = React.useCallback((withCheck) => {
        setState((previous) => Object.assign({}, previous, { phase: "loading" }));
        fetch(withCheck === true ? "/blockfire/update?check=1" : "/blockfire/update", { headers: { accept: "application/json" } })
          .then((response) => response.json())
          .then((payload) => {
            if (payload && payload.ok === true) setState({ phase: "ready", payload: payload });
            else setState({ phase: "error", message: (payload && payload.error) || "unknown error" });
          })
          .catch((error) => setState({ phase: "error", message: String(error && error.message ? error.message : error) }));
      }, []);
      React.useEffect(() => {
        load(false);
      }, [load]);

      if (state.phase === "loading") return h("div", { style: VALUE }, "Reading update state…");
      if (state.phase === "error") {
        return h("div", null, [
          h("div", { style: Object.assign({}, VALUE, { color: "var(--dsw-alias-state-error-primary)" }), key: "e" }, `Update Center unavailable: ${state.message}`),
          h("div", { style: { marginTop: 10 }, key: "c" }, h("code", { style: CODE }, "harness/install.sh")),
        ]);
      }

      const payload = state.payload;
      const status = payload.status || {};
      const active = status.active || null;
      const previous = status.previous || null;
      const staged = Object.keys(status.staged || {});
      const verified = status.verified || {};
      const check = payload.check || null;
      const newer = check && Array.isArray(check.newer) ? check.newer : [];
      const channels = check && Array.isArray(check.channels) ? check.channels : [];

      return h("div", null, [
        h("div", { style: CARD, key: "now" }, [
          h("div", { style: { fontWeight: 600, marginBottom: 6, color: "var(--dsw-alias-label-primary)" }, key: "t" }, "Runtime"),
          row(
            "installed (resolver)",
            status.runningInstall
              ? `${status.runningInstall.version}${status.runningInstall.sourceLabel ? ` — ${status.runningInstall.sourceLabel}` : ""}`
              : "unknown",
          ),
          row("launcher pin", active ? `${active.version}` : "none — resolver default"),
          row("rollback target", previous ? previous.version : "none"),
          row(
            "staged candidates",
            staged.length === 0 ? "none" : staged.map((version) => `${version} ${verified[version] ? (verified[version].ok ? "[verified]" : "[failed]") : "[unverified]"}`).join(", "),
          ),
        ]),
        h("div", { style: CARD, key: "up" }, [
          h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }, key: "head" }, [
            h("div", { style: { fontWeight: 600, color: "var(--dsw-alias-label-primary)" }, key: "t" }, "Upstream"),
            h("button", { style: BUTTON, key: "b", onClick: () => load(true) }, check === null ? "Check now" : "Re-check"),
          ]),
          check === null
            ? h("div", { style: VALUE, key: "n" }, "Not checked yet in this process. Nothing is installed or replaced by checking.")
            : h("div", { key: "c" }, [
                ...channels.map((channel) =>
                  row(
                    `channel ${channel.channel}`,
                    channel.notesUrl
                      ? h("span", null, [channel.version, " ", h("a", { href: channel.notesUrl, target: "_blank", rel: "noreferrer", style: { color: "var(--dsw-alias-brand-primary)" }, key: "a" }, "release notes")])
                      : channel.version,
                  ),
                ),
                newer.length === 0
                  ? row("newer versions", "none published", "var(--dsw-alias-state-success-primary)")
                  : row("newer versions", newer.map((entry) => entry.version).join(", "), "var(--dsw-alias-state-warn-primary)"),
              ]),
        ]),
        h("div", { style: CARD, key: "how" }, [
          h("div", { style: { fontWeight: 600, marginBottom: 6, color: "var(--dsw-alias-label-primary)" }, key: "t" }, "How an update happens"),
          h("div", { style: Object.assign({}, VALUE, { marginBottom: 8 }), key: "p" }, "Never automatic. The candidate is installed into an isolated tree, the compatibility suite runs against that tree, and only a passing candidate can be activated. The previous version stays available for rollback, and a switch takes effect on the next launch."),
          h("div", { style: { display: "grid", gap: 6 }, key: "cmds" }, [
            h("code", { style: CODE, key: "1" }, "node harness/bin/update.mjs check"),
            h("code", { style: CODE, key: "2" }, "node harness/bin/update.mjs stage <version>"),
            h("code", { style: CODE, key: "3" }, "node harness/bin/update.mjs verify <version>"),
            h("code", { style: CODE, key: "4" }, "node harness/bin/update.mjs activate <version>"),
            h("code", { style: CODE, key: "5" }, "node harness/bin/update.mjs rollback"),
          ]),
        ]),
      ]);
    }

    // ── 2. session stats (below the live activity, above the composer) ──────

    // Same quiet style as the shipped stats line — no background, centered —
    // with two legibility fixes over it: label-secondary text instead of
    // tertiary, and icon+value groups without separator bars. The slot
    // registration uses order -10 so it lands ABOVE the todo dock (order 0),
    // which otherwise covers it: directly below the live status line.
    const STAT = {
      color: "var(--dsw-alias-label-secondary)",
      fontSize: 12,
      lineHeight: "18px",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
      padding: "4px 16px 6px",
      width: "100%",
      boxSizing: "border-box",
    };
    const STAT_GROUP = { display: "inline-flex", alignItems: "center", gap: 4 };
    const STAT_ICON = { display: "inline-flex", alignItems: "center", color: "var(--dsw-alias-label-secondary)" };

    function fmtDuration(ms) {
      const s = Math.max(0, ms) / 1000;
      if (s < 1) return `${Math.round(s * 10) / 10}s`;
      if (s < 60) return `${Math.round(s * 10) / 10}s`;
      if (s < 3600) return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
      return `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m`;
    }
    function fmtTps(tps) {
      const clamped = Math.max(0, tps);
      return clamped >= 10 ? String(Math.round(clamped)) : String(Math.round(clamped * 10) / 10);
    }
    function fmtTokens(value) {
      const scaled = (candidate) => (candidate >= 100 ? String(Math.round(candidate)) : String(Math.round(candidate * 10) / 10));
      if (value < 1000) return String(value);
      if (value < 1e6) return `${scaled(value / 1e3)}k`;
      return `${scaled(value / 1e6)}M`;
    }

    /** One icon+value group inside the dark pill. */
    function statGroup(icon, text, key) {
      return h("span", { style: STAT_GROUP, key }, [
        icon === undefined ? null : h("span", { style: STAT_ICON, key: "i" }, icon),
        text,
      ]);
    }

    /**
     * Session figures directly below the model's live activity and above the
     * composer card: turns · steps, LLM wall time, decode speed, cache hit,
     * and input/output tokens. Data rides the `sessionStats` and `tokenUsage`
     * projection units, so it updates while the agent works. Read-only leaf
     * fields.
     */
    function StatsStrip({ useProjection }) {
      if (useProjection === undefined) return null;
      const stats = useProjection("sessionStats");
      const usage = useProjection("tokenUsage");
      const groups = [];
      if (stats !== undefined && stats !== null && stats.steps > 0) {
        groups.push(statGroup(undefined, `${stats.turns} ${stats.turns === 1 ? "turn" : "turns"} · ${stats.steps} steps`, "counts"));
        if (stats.llmMs > 0) groups.push(statGroup(h(primitives.IconClockOutline16, { key: "ti" }), fmtDuration(stats.llmMs), "llm"));
        if (stats.decodeMs > 0) {
          groups.push(statGroup(h(primitives.IconEnhanceOutline16, { key: "sp" }), `${fmtTps(stats.decodeTokens / (stats.decodeMs / 1000))} t/s`, "speed"));
        }
      }
      if (usage !== undefined && usage !== null && (usage.outputTokens > 0 || usage.uncachedInputTokens > 0)) {
        const billed = usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
        if (billed > 0) {
          const hit = Math.round((usage.cacheReadTokens / billed) * 100);
          groups.push(statGroup(h(primitives.IconDatabaseOutline16, { key: "ca" }), `Cache ${hit}%`, "cache"));
        }
        groups.push(statGroup(
          h(primitives.IconDatabaseOutline16, { key: "io" }),
          `In ${fmtTokens(billed)} · Out ${fmtTokens(usage.outputTokens)}`,
          "tokens",
        ));
      }
      if (groups.length === 0) return null;
      return h("div", { style: STAT, title: "Session stats" }, groups);
    }

    /** Replaces upstream's composer.dock stats occupant by id ("stats"). */
    function NullStats() {
      return null;
    }

    // ── 3. new-session button (sidebar footer) ───────────────────────────────

    /**
     * Small always-visible "+ New" beside Settings. Calls the workspace UI
     * capability upstream's own rows use (reuse the provisional blank session
     * of the current/recent workspace, else create one). The capability is
     * resolved at render time because this plugin loads before ui-workspace
     * in the browser roster.
     */
    function NewSessionButton({ pluginCtx }) {
      const [busy, setBusy] = React.useState(false);
      const uiWorkspace = pluginCtx.get("uiWorkspace");
      if (uiWorkspace === undefined) return null;
      const onClick = () => {
        if (busy) return;
        setBusy(true);
        try {
          uiWorkspace.startSession();
        } finally {
          setBusy(false);
        }
      };
      return h(
        "button",
        {
          type: "button",
          "aria-label": "New session",
          title: "New session",
          onClick,
          style: {
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            cursor: "pointer",
            border: "1px solid var(--dsw-alias-border-l2)",
            borderRadius: 8,
            background: "var(--dsw-alias-bg-layer-2)",
            color: "var(--dsw-alias-label-primary)",
            padding: "4px 8px",
            fontSize: 12,
            lineHeight: "16px",
          },
        },
        [
          h("span", { style: { display: "inline-flex", alignItems: "center" }, key: "i" }, h(primitives.IconPlusOutline16, { key: "p" })),
          h("span", { key: "t" }, "New"),
        ],
      );
    }

    // ── 4. permanent delete (session header utilities) ───────────────────────

    const DELETE = {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      cursor: "pointer",
      border: "1px solid var(--dsw-alias-border-l2)",
      borderRadius: 6,
      background: "transparent",
      color: "var(--dsw-alias-label-tertiary)",
      padding: "2px 8px",
      fontSize: 12,
      lineHeight: "18px",
    };
    const DELETE_ARMED = Object.assign({}, DELETE, {
      color: "var(--dsw-alias-state-error-primary)",
      borderColor: "var(--dsw-alias-state-error-primary)",
    });

    /**
     * Two-step permanent delete of the CURRENT session. Step 1 arms the
     * button ("Delete forever?"); step 2 posts to the host route, which
     * refuses running sessions, removes the log + projection cache entry,
     * and drops the id from workspace accounting through the workspace
     * storage domain. On success the strip waits for the sidebar feed to
     * drop the id, then opens a session in the same workspace.
     */
    function DeleteSessionButton({ sessionId, uiWorkspace, workspaces }) {
      const [armed, setArmed] = React.useState(false);
      const [busy, setBusy] = React.useState(false);
      const [error, setError] = React.useState(null);
      React.useEffect(() => {
        setArmed(false);
        setError(null);
      }, [sessionId]);

      const run = () => {
        if (busy) return;
        setBusy(true);
        setError(null);
        fetch("/blockfire/session/delete", {
          method: "POST",
          headers: { "content-type": "application/json", "x-blockfire-delete": "1" },
          body: JSON.stringify({ sessionId }),
        })
          .then((response) => response.json())
          .then((payload) => {
            if (!(payload && payload.ok === true)) throw new Error((payload && payload.error) || "delete failed");
            setArmed(false);
            // Navigate away once the workspace feed reflects the deletion, so
            // startSession cannot reuse the just-deleted provisional blank.
            const deadline = Date.now() + 3000;
            const leave = () => {
              const snapshot = workspaces !== undefined ? workspaces.list.getSnapshot() : undefined;
              const gone =
                snapshot === undefined ||
                snapshot.items === undefined ||
                snapshot.items.every((item) => item === null || item.sessionIds === undefined || !item.sessionIds.includes(sessionId));
              if (gone || Date.now() > deadline) uiWorkspace.startSession();
              else setTimeout(leave, 120);
            };
            leave();
          })
          .catch((cause) => {
            setError(String(cause && cause.message ? cause.message : cause));
            setBusy(false);
          });
      };

      return h("div", { style: { display: "inline-flex", alignItems: "center", gap: 6 } }, [
        h(
          "button",
          {
            type: "button",
            key: "b",
            style: armed ? DELETE_ARMED : DELETE,
            disabled: busy,
            "aria-label": armed ? "Confirm permanent delete" : "Delete session permanently",
            title: armed ? "Click again to delete permanently" : "Delete permanently",
            onClick: () => (armed ? run() : setArmed(true)),
          },
          [
            h("span", { style: { display: "inline-flex", alignItems: "center" }, key: "i" }, h(primitives.IconTrashOutline16, { key: "t" })),
            armed ? "Delete forever?" : "Delete",
          ],
        ),
        error === null
          ? null
          : h("span", { style: { color: "var(--dsw-alias-state-error-primary)", fontSize: 12 }, key: "e" }, error),
      ]);
    }

    // ── registration ─────────────────────────────────────────────────────────

    function apply(ctx) {
      const slots = ctx.get("slots");
      if (slots === undefined) return;

      slots.inject("settings.section", () =>
        slots.register({ name: "settings.section", id: "blockfire-update", order: 25, label: "BLOCKFIRE" }, UpdateCenter),
      );

      const workspaces = ctx.get("workspaces");

      slots.inject("sidebar.footer.action", () =>
        slots.register(
          { name: "sidebar.footer.action", id: "blockfire-new-session", order: 0, label: "New session" },
          () => NewSessionButton({ pluginCtx: ctx }),
        ),
      );

      slots.inject("conversation.input.dock", () =>
        // order -10: above the todo dock (order 0) and goal bar (order 10) —
        // directly below the model's live status line, never covered by them.
        slots.register({ name: "conversation.input.dock", id: "blockfire-stats", order: -10, label: "Session stats" }, StatsStrip),
      );

      // Same id as upstream's composer.dock stats occupant, one step LOWER
      // priority — the slot contract is "register at a different priority to
      // shadow it (lowest renders)" — and rendered as null. `priority` (not
      // `order`) is the shadowing axis; a duplicate id at the same priority
      // throws and fails the whole chat plugin. The figures live once, in the
      // input dock above the composer card.
      slots.inject("conversation.composer.dock", () =>
        slots.register({ name: "conversation.composer.dock", id: "stats", priority: -1, order: 0, label: "Session stats" }, NullStats),
      );

      slots.inject("conversation.session.header.utilities", () =>
        slots.register(
          { name: "conversation.session.header.utilities", id: "blockfire-delete", order: 50, label: "Delete permanently" },
          (props) => {
            // Session-scoped slots receive `sessionId` as a standard prop
            // (the ui-session BUILTIN_SOURCE `props: ["sessionId"]`). The
            // workspace capability resolves at render time: this plugin loads
            // before ui-workspace in the browser roster.
            const sessionId = props !== undefined ? props.sessionId : undefined;
            const uiWorkspace = ctx.get("uiWorkspace");
            if (sessionId === undefined || uiWorkspace === undefined) return null;
            return DeleteSessionButton({ sessionId, uiWorkspace, workspaces });
          },
        ),
      );
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
