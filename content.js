(() => {
  console.log("content script loaded");

  // ENVIRONMENT & STATE
  let isPopup = false;

  const getPageContext = () => {
    const path = location.pathname;

    if (/^\/live\//.test(path)) return "live";
    if (/^\/video\//.test(path)) return "video";
    if (/^\/[^/]+$/.test(path)) return "channel";

    return null;
  };

  // SELECTORS
  const CONTROL_ROOT_SELECTOR = {
    channel: '[class*="channel_profile_control"]',
    live: '[class*="video_information_control"]',
    video: '[class*="video_information_control"]',
  };

  const SELECTORS = {
    get subscribedBtn() {
      const context = getPageContext();
      return [
        ...document.querySelectorAll(
          `${CONTROL_ROOT_SELECTOR[context]} button`,
        ),
      ].find((el) => el.textContent.trim() === "구독중");
    },
    get subscribeContainer() {
      return [
        ...document.querySelectorAll('[class*="subscribe_container"]'),
      ].find((el) => {
        const header = el.querySelector('[class*="popup_header"]');
        return header?.textContent.trim() === "내 정기구독 관리";
      });
    },
    get subscribeViewAllAction() {
      return document.querySelector(".subscribe__box-action");
    },
  };

  // OBSERVER
  function awaitElement(getter, root = document.body) {
    return new Promise((resolve) => {
      const el = getter();
      if (el) {
        resolve(el);
        return;
      }

      const observer = new MutationObserver(() => {
        const el = getter();
        if (!el) return;

        observer.disconnect();
        resolve(el);
      });

      observer.observe(root, { childList: true, subtree: true });
    });
  }

  function onElementRemoved(target, onGone, root = document.body) {
    const getter = typeof target === "function" ? target : () => target;

    const el = getter();
    if (!el) return;

    const observer = new MutationObserver(() => {
      const current = getter();
      if (current && current.isConnected) return;

      observer.disconnect();
      onGone();
    });

    observer.observe(root, { childList: true, subtree: true });
  }

  // CORE ACTION
  function findTargetArea(container) {
    const areas = [...container.querySelectorAll('[class*="subscribe_area"]')];
    return areas[2] ?? null;
  }

  function prepareBox(area) {
    const box = area.querySelector('[class*="subscribe_box"]');
    if (!box) return null;

    Object.assign(box.style, {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    });

    return box;
  }

  function createOpenButton() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "subscribe__box-action";
    btn.textContent = "전체보기";

    Object.assign(btn.style, {
      appearance: "none",
      background: "none",
      border: "none",

      color: "var(--Content-Neutral-Cool-Weak)",
      fontSize: "inherit",
      padding: "4px 0",
      marginLeft: "8px",

      textDecoration: "underline",
      cursor: "pointer",
    });

    return btn;
  }

  function bindOpenLayer(container) {
    console.log("전체보기 클릭");
  }

  async function modifyContainer(container) {
    const area = findTargetArea(container);
    if (!area) return;

    const box = prepareBox(area);
    if (!box) return;

    const btn = createOpenButton();
    btn.addEventListener("click", () => bindOpenLayer(container));

    box.appendChild(btn);
  }

  // LIFECYCLE
  async function getSubscribeContainer() {
    if (isPopup) return;
    isPopup = true;

    const container = await awaitElement(() => SELECTORS.subscribeContainer);

    onElementRemoved(container, () => (isPopup = false));
    modifyContainer(container);
  }

  async function init() {
    const btn = await awaitElement(() => SELECTORS.subscribedBtn);
    btn.addEventListener("click", getSubscribeContainer);
  }
  init();
})();
