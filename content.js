(() => {
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
    get layerCloseBtn() {
      return document.querySelector('[class*="agree_guide_close_button"]');
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

  function customizeProgressSection(area) {
    const progress = area.querySelector('[class*="subscribe_progress"]');
    if (!progress) return null;

    const badges = progress.querySelectorAll('[class*="subscribe_badge__"]');
    if (!badges[1]) return progress;

    const badge = badges[1];
    const img = badge.querySelector('[class*="subscribe_image"]');
    if (!img) return progress;

    // wrapper
    const wrap = document.createElement("div");
    wrap.style.position = "relative";

    img.style.opacity = ".5";
    img.parentNode.insertBefore(wrap, img);
    wrap.appendChild(img);

    const lock = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    lock.setAttribute("width", "8");
    lock.setAttribute("height", "10");
    lock.setAttribute("viewBox", "0 0 8 10");
    lock.setAttribute("fill", "none");
    lock.classList.add("subscribe_icon_lock__Mnpnv");

    lock.innerHTML = `
    <path d="M0.5 5.5001C0.5 4.7269 1.1268 4.1001 1.9 4.1001H6.1C6.8732 4.1001 7.5 4.7269 7.5 5.5001V8.1001C7.5 8.87329 6.8732 9.5001 6.1 9.5001H1.9C1.1268 9.5001 0.5 8.8733 0.5 8.1001V5.5001Z" fill="white"></path>
    <path d="M1.8998 3.2C1.8998 2.0402 2.84001 1.1 3.9998 1.1C5.1596 1.1 6.0998 2.0402 6.0998 3.2V5.9H1.8998V3.2Z" stroke="white" stroke-width="1.2"></path>
  `;

    wrap.appendChild(lock);

    const gauge = progress.querySelector('[class*="subscribe_gauge"]');
    if (gauge) gauge.style.width = "99%";

    return progress;
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

  const getChannelId = async () => {
    const context = getPageContext();

    if (context === "live") {
      const m = location.href.match(/\/live\/([a-f0-9]{32})/i);
      return m?.[1] ?? null;
    }

    if (context === "channel") {
      const m = location.pathname.match(/^\/([a-f0-9]{32})$/i);
      return m?.[1] ?? null;
    }

    if (context === "video") {
      const m = location.pathname.match(/\/video\/(\d+)/);
      const videoId = m?.[1];
      if (!videoId) return null;

      try {
        const res = await fetch(
          `https://api.chzzk.naver.com/service/v3/videos/${videoId}`,
          { credentials: "include" },
        );

        const json = await res.json();
        return json?.content?.channel?.channelId ?? null;
      } catch {
        return null;
      }
    }

    return null;
  };

  const fetchTiers = async (channelId) => {
    const res = await fetch(
      `https://api.chzzk.naver.com/commercial/v1/channels/${channelId}/subscription/tiers`,
      { credentials: "include" },
    );
    return res.json();
  };

  function buildContent(json) {
    const frag = document.createDocumentFragment();
    const tiers = json.content.subscriptionTierInfoList;

    tiers.forEach((tier, idx) => {
      const tierWrap = document.createElement("div");
      tierWrap.style.padding = "12px 0";

      // title
      const p = document.createElement("p");
      p.classList.add("subscribe_text__QTyrG", "subscription_box__F674Z");
      p.style.marginBottom = "8px";

      const em = document.createElement("em");
      em.className = "subscription_ellipsis__NTT+g";
      em.textContent = tier.brandName;

      const strong = document.createElement("strong");
      strong.className = "subscription_word__vAMdf";
      strong.textContent = " 구독 배지";

      p.append(em, strong);
      tierWrap.appendChild(p);

      // badge list
      const ol = document.createElement("ol");
      ol.classList.add(
        "subscribe_badge_list__Q-eS",
        "subscribe_emoticon__gosve",
      );

      tier.subscriptionBadgeList.forEach((badge) => {
        const li = document.createElement("li");
        li.className = "subscribe_badge_item__j2exr";

        const thumb = document.createElement("div");
        thumb.className = "subscribe_badge_thumbnail__osg+q";

        const img = document.createElement("img");
        img.src = badge.imageUrl;
        img.width = 36;
        img.height = 36;
        img.alt = "";
        img.className = "subscribe_badge_image__lVGa8";

        thumb.appendChild(img);

        const label = document.createElement("p");
        label.className = "subscribe_badge_label__R448r";
        label.textContent = `${badge.month}개월`;

        li.append(thumb, label);
        ol.appendChild(li);
      });

      tierWrap.appendChild(ol);
      frag.appendChild(tierWrap);

      // divider
      if (idx < tiers.length - 1) {
        const divider = document.createElement("div");
        divider.style.height = "1px";
        divider.style.background = "rgba(255,255,255,.08)";
        frag.appendChild(divider);
      }
    });

    return frag;
  }

  function renderLayer(contentNode) {
    const layer = document.createElement("div");
    layer.classList.add(
      "agree_guide_layer__+Bf5P",
      "agree_guide_green__2yc+U",
      "subscribe_layer__AkF-z",
    );

    const area = document.createElement("div");
    area.className = "agree_guide_area__Pd9wN";
    area.style.overflowY = "auto";

    // scrollbar hide
    area.style.scrollbarWidth = "none";
    area.style.msOverflowStyle = "none";

    const group = document.createElement("div");
    group.className = "agree_guide_group__ASV4J";
    group.appendChild(contentNode);

    area.appendChild(group);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "닫기");
    closeBtn.classList.add(
      "button_container__ppWwB",
      "button_only_icon__kahz5",
      "button_smaller__98NMU",
      "agree_guide_close_button__Eh6LO",
    );
    closeBtn.textContent = "✕";

    layer.append(area, closeBtn);

    Object.assign(layer.style, {
      top: "110px",
      bottom: "16px",
      maxHeight: "calc(100% - 126px)",
    });

    const style = document.createElement("style");
    style.textContent = `
    .agree_guide_area__Pd9wN::-webkit-scrollbar {
      display: none;
    }
  `;
    document.head.appendChild(style);

    return layer;
  }

  const mountLayer = (root, layer) => {
    root.querySelector(".subscribe_layer__AkF-z")?.remove();
    root.classList.add("subscribe_dimmed__98bz7");

    root.appendChild(layer);

    const closeBtn = SELECTORS.layerCloseBtn;

    if (closeBtn) {
      closeBtn.onclick = () => {
        layer.remove();
        root.classList.remove("subscribe_dimmed__98bz7");
      };
    }
  };

  const bindAllBadgeLayer = async (btn) => {
    const root = SELECTORS.subscribeContainer;

    const channelId = await getChannelId();
    if (!root || !channelId) return;

    const json = await fetchTiers(channelId);
    const html = buildContent(json);
    const layer = renderLayer(html);
    mountLayer(root, layer);
  };

  async function modifyContainer(container) {
    const area = findTargetArea(container);
    if (!area) return;

    const box = prepareBox(area);
    if (!box) return;

    const btn = createOpenButton();
    btn.addEventListener("click", () => bindAllBadgeLayer(container));

    const progress = customizeProgressSection(area);
    box.appendChild(btn);
  }

  // LIFECYCLE
  let lastPath = null;

  async function getSubscribeContainer() {
    if (isPopup) return;
    isPopup = true;

    const container = await awaitElement(() => SELECTORS.subscribeContainer);

    onElementRemoved(container, () => (isPopup = false));
    modifyContainer(container);
  }

  function hookSpaLifecycle(onChange) {
    let lastUrl = location.href;

    const notifyIfChanged = () => {
      if (location.href === lastUrl) return;
      lastUrl = location.href;
      onChange();
    };

    ["pushState", "replaceState"].forEach((key) => {
      const original = history[key];
      history[key] = function () {
        const result = original.apply(this, arguments);
        queueMicrotask(notifyIfChanged);
        return result;
      };
    });

    window.addEventListener("popstate", notifyIfChanged);

    new MutationObserver(notifyIfChanged).observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  async function init() {
    const path = location.pathname;
    if (path === lastPath) return;
    lastPath = path;

    const context = getPageContext();
    if (!context) return;

    const btn = await awaitElement(() => SELECTORS.subscribedBtn);
    btn.addEventListener("click", getSubscribeContainer);
  }

  hookSpaLifecycle(init);
  init();
})();
