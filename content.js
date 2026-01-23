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
  };

  window.SELECTORS = SELECTORS; // DEBUG

  // OBSERVER
  function waitForElement(getter, root = document.body) {
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

  // CORE ACTION
  function modifyContainer(container) {
    console.log(container);
  }

  // LIFECYCLE
  async function getSubscribeContainer() {
    if (isPopup) return;
    isPopup = true;

    const container = await waitForElement(() => SELECTORS.subscribeContainer);
    const closeBtn = container.querySelector('[class*="popup_action"]');

    modifyContainer(container);

    closeBtn.addEventListener("click", () => {
      isPopup = false;
    });
  }

  async function init() {
    const btn = await waitForElement(() => SELECTORS.subscribedBtn);
    btn.addEventListener("click", getSubscribeContainer);
  }
  init();
})();
