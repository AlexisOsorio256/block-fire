window.__ModuleLoader__.load({
  id: "@blockfire/harness-web",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    let React = require("react");

    /**
     * BLOCKFIRE Update Center — browser half.
     *
     * One settings section that reads the read-only host route and reports what
     * is installed, what is staged and what passed the compatibility suite. It
     * never switches versions: the panel shows the exact CLI command instead,
     * because installing and switching are privileged, deliberate actions.
     */
    const inject = ["slots"];

    const h = React.createElement;

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
      return h("div", { style: ROW }, [
        h("div", { style: LABEL, key: "l" }, label),
        h("div", { style: style, key: "v" }, value),
      ]);
    }

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
          h("div", { style: { marginTop: 10 } , key: "c" }, h("code", { style: CODE }, "harness/install.sh")),
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

      const children = [
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
      ];
      return h("div", null, children);
    }

    function apply(ctx) {
      const slots = ctx.get("slots");
      if (slots === undefined) return;
      slots.inject("settings.section", () =>
        slots.register({ name: "settings.section", id: "blockfire-update", order: 25, label: "BLOCKFIRE" }, UpdateCenter),
      );
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
