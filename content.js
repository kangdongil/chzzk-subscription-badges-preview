(() => {
  console.log("content script loaded");

  const getPageContext = () => {
    const path = location.pathname;

    if (/^\/live\//.test(path)) return "live";
    if (/^\/video\//.test(path)) return "video";
    if (/^\/[^/]+$/.test(path)) return "channel";

    return null;
  };

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
  };

  window.SELECTORS = SELECTORS; // DEBUG
})();
