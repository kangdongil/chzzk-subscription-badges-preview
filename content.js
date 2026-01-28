(() => {
  // ENVIRONMENT & STATE
  const state = {
    __spaHooked: false,
    initRunning: false,
    isPopup: false,
    currentTierNo: null,
    subscribeInfo: null,
  };

  const PAGE_MATCHERS = [
    ["live", /^\/live\//],
    ["video", /^\/video\//],
    ["channel", /^\/[^/]+$/],
  ];

  const getPageContext = () => {
    const path = location.pathname;

    return PAGE_MATCHERS.find(([, r]) => r.test(path))?.[0] ?? null;
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
      if (!context) return null;

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
  function awaitElement(getter, root = document.body, timeout = 10000) {
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

      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
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

  async function customizeProgressSection(area, info) {
    if (!info) return;

    const progress = area.querySelector('[class*="subscribe_progress"]');
    if (!progress) return null;

    const badges = progress.querySelectorAll('[class*="subscribe_badge__"]');
    if (!badges[1]) return progress;

    const nextBadge = badges[1];
    const img = nextBadge.querySelector('[class*="subscribe_image"]');
    if (!img) return progress;

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

    // right label dim
    const rightLabel = nextBadge.querySelector("p");
    if (rightLabel) rightLabel.style.color = "var(--Content-Neutral-Cool-Weak)";

    const {
      badgeProgressRatio: percent,
      badgeRemainingBreakdown: remaining,
      spanMonths,
    } = calcDailyGauge(info);

    const gauge = progress.querySelector('[class*="subscribe_gauge"]');
    if (gauge) gauge.style.width = `${percent}%`;

    const bar = progress.querySelector('[class*="subscribe_bar"]');
    if (!bar) return progress;

    let label = bar.querySelector(".subscribe_remaining");

    if (!label) {
      label = document.createElement("p");
      label.className = "subscribe_remaining";
      Object.assign(label.style, {
        marginTop: "12px",
        textAlign: "center",
        fontSize: "12px",
        color: "var(--Content-Neutral-Cool-Weak)",
        lineHeight: "1.2",
      });
      bar.appendChild(label);
    }

    label.textContent = formatRemaining(remaining);

    let ticks = bar.querySelector(".subscribe_ticks");
    const steps = spanMonths <= 6 ? spanMonths * 2 : spanMonths;
    const stepsSafe = Math.max(1, steps);

    if (!ticks) {
      ticks = document.createElement("div");
      ticks.className = "subscribe_ticks";

      Object.assign(ticks.style, {
        position: "absolute",
        inset: "0",
        top: "-4px",
        height: "8px",
        display: "flex",
        justifyContent: "space-between",
        pointerEvents: "none",
      });

      bar.appendChild(ticks);
    }

    /* reset */
    ticks.innerHTML = "";

    /* leading spacer */
    ticks.appendChild(document.createElement("i"));

    for (let i = 0; i < stepsSafe - 1; i++) {
      const t = document.createElement("span");

      Object.assign(t.style, {
        width: "1px",
        background: "rgba(255,255,255,.2)",
      });

      ticks.appendChild(t);
    }

    /* trailing spacer */
    ticks.appendChild(document.createElement("i"));

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

  const getSubscribeInfo = async () => {
    const channelId = await getChannelId();
    if (!channelId) return null;

    try {
      const res = await fetch(
        `https://api.chzzk.naver.com/commercial/v1/subscribe/channels/${channelId}`,
        { credentials: "include" },
      );

      const json = await res.json();
      return json?.content?.info ?? null;
    } catch {
      return null;
    }
  };

  // month arithmetic
  function addMonths(date, months) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
  }

  // ms → { days, hours, minutes }
  function breakdownDuration(ms) {
    if (ms <= 0) return { days: 0, hours: 0, minutes: 0 };

    const totalMinutes = Math.floor(ms / 60000);

    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    return { days, hours, minutes };
  }

  function calcDailyGauge(json) {
    const { lastBadgeMonth, nextBadgeMonth, nextPublishYmdt } = json;

    if (!nextPublishYmdt) return 0;

    const spanMonths = nextBadgeMonth - lastBadgeMonth;
    if (spanMonths <= 0) return 0;

    const nextBadgeStartDate = new Date(
      nextPublishYmdt.replace(" ", "T") + "+09:00",
    );

    const lastBadgeStartDate = addMonths(nextBadgeStartDate, -spanMonths);

    const now = new Date();

    const badgeProgressPeriodMs = nextBadgeStartDate - lastBadgeStartDate;
    const badgeElapsedMs = now - lastBadgeStartDate;
    const badgeRemainingMs = nextBadgeStartDate - now;

    const badgeProgressPeriod = badgeProgressPeriodMs / (1000 * 60 * 60 * 24);
    const badgeElapsedDays = badgeElapsedMs / (1000 * 60 * 60 * 24);
    const badgeRemainingDays = badgeRemainingMs / (1000 * 60 * 60 * 24);

    const rawRatio = badgeElapsedMs / badgeProgressPeriodMs;
    const badgeProgressRatio = Math.min(
      100,
      Math.max(0, +(rawRatio * 100).toFixed(2)),
    );

    const badgeRemainingBreakdown = breakdownDuration(badgeRemainingMs);

    // console.log("[badge-debug]", {
    //   lastBadgeStartDate,
    //   nextBadgeStartDate,
    //   badgeProgressPeriod: +badgeProgressPeriod.toFixed(2),
    //   badgeElapsedDays: +badgeElapsedDays.toFixed(2),
    //   badgeRemainingDays: +badgeRemainingDays.toFixed(2),
    //   badgeProgressRatio,
    //   badgeRemainingBreakdown,
    // });
    return { badgeProgressRatio, badgeRemainingBreakdown, spanMonths };
  }

  function formatRemaining({ days, hours, minutes }) {
    if (days > 0) return `${days}일 남음`;
    if (hours > 0) return `${hours}시간 남음`;
    return `${minutes}분 남음`;
  }

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

    tiers.sort((a, b) => {
      if (a.tier === state.currentTierNo) return -1;
      if (b.tier === state.currentTierNo) return 1;

      return b.tier - a.tier;
    });
    tiers.forEach((tier) => {
      const isActiveTier =
        state.currentTierNo != null && tier.tier === state.currentTierNo;
      const tierWrap = document.createElement("div");
      tierWrap.style.padding = "12px 0";

      // title
      const p = document.createElement("p");
      p.classList.add("subscribe_text__QTyrG", "subscription_box__F674Z");
      if (isActiveTier) {
        p.style.marginBottom = "6px";
      } else {
        p.style.marginBottom = "1px";
      }

      const em = document.createElement("em");
      em.className = "subscription_ellipsis__NTT+g";
      em.textContent = tier.brandName;

      if (!isActiveTier) {
        em.style.color = "var(--Content-Neutral-Warm-Strong)";
        em.style.filter = "grayscale(1) brightness(.85)";
      }

      const strong = document.createElement("strong");
      strong.className = "subscription_word__vAMdf";
      strong.textContent = " 구독 배지";
      strong.style.marginLeft = "4px";

      p.append(em, strong);
      tierWrap.appendChild(p);

      // badge list
      const ol = document.createElement("ol");
      ol.classList.add(
        "subscribe_badge_list__Q-eS",
        "subscribe_emoticon__gosve",
      );
      if (!isActiveTier) {
        ol.style.opacity = ".4";
        ol.style.filter = "grayscale(.8) brightness(.85)";
        ol.style.transform = "scale(.92)";
        ol.style.transformOrigin = "center";
        ol.style.gap = "10px 14px";
        ol.style.padding = "6px 0";
      }

      const totalMonth = state.subscribeInfo?.totalMonth ?? 0;

      // 내가 도달한 마지막 badge index
      let lastReachedIndex = -1;
      tier.subscriptionBadgeList.forEach((b, i) => {
        if (b.month <= totalMonth) lastReachedIndex = i;
      });

      // 현재 + 다음 1개까지 오픈
      const openUntilIndex = lastReachedIndex + 1;

      tier.subscriptionBadgeList.forEach((badge, idx) => {
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

        if (isActiveTier && idx > openUntilIndex) {
          li.classList.add("subscribe_is_locked__tenGP");

          const lock = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "svg",
          );
          lock.setAttribute("width", "8");
          lock.setAttribute("height", "10");
          lock.setAttribute("viewBox", "0 0 8 10");
          lock.setAttribute("fill", "none");
          lock.classList.add("subscribe_icon_lock__Mnpnv");

          lock.innerHTML = `
      <path d="M0.5 5.5001C0.5 4.7269 1.1268 4.1001 1.9 4.1001H6.1C6.8732 4.1001 7.5 4.7269 7.5 5.5001V8.1001C7.5 8.87329 6.8732 9.5001 6.1 9.5001H1.9C1.1268 9.5001 0.5 8.8733 0.5 8.1001V5.5001Z" fill="white"></path>
      <path d="M1.8998 3.2C1.8998 2.0402 2.84001 1.1 3.9998 1.1C5.1596 1.1 6.0998 2.0402 6.0998 3.2V5.9H1.8998V3.2Z" stroke="white" stroke-width="1.2"></path>
    `;

          thumb.appendChild(lock);
        }

        li.append(thumb, label);
        ol.appendChild(li);
      });

      tierWrap.appendChild(ol);
      frag.appendChild(tierWrap);

      // divider
      if (tier !== tiers[tiers.length - 1]) {
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

    // area.style.flex = "0 0 auto";
    area.style.maxHeight = "fit-content";

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

    state.currentTierNo = state.subscribeInfo?.tierNo ?? null;

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

    customizeProgressSection(area, state.subscribeInfo);
    box.appendChild(btn);
  }

  // LIFECYCLE
  async function getSubscribeContainer() {
    if (state.isPopup) return;
    state.isPopup = true;

    const container = await awaitElement(() => SELECTORS.subscribeContainer);

    if (!container) {
      state.isPopup = false;
      return;
    }

    onElementRemoved(container, () => (state.isPopup = false));
    modifyContainer(container);
  }

  function bindBtn(btn) {
    if (!btn || btn._badgeBound) return;
    btn._badgeBound = true;
    btn.addEventListener("click", getSubscribeContainer);
  }

  function awaitSubscribedBtn() {
    return awaitElement(() => SELECTORS.subscribedBtn);
  }

  function startUrlPolling(onTick, interval = 1000) {
    let timer;

    const start = () => (timer ??= setInterval(onTick, interval));
    const stop = () => timer && (clearInterval(timer), (timer = null));

    start();

    document.addEventListener("visibilitychange", () =>
      document.hidden ? stop() : start(),
    );
  }

  function hookSpaLifecycle(onChange) {
    // --- prevent duplicate hookSpaLifecycle
    if (state.__spaHooked) return;
    state.__spaHooked = true;

    // --- detect actual URL changes(with debounce)
    let lastUrl = location.href;
    let debounceTimer;
    const notifyIfChanged = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (location.href === lastUrl) return;
        lastUrl = location.href;
        onChange();
      }, 120);
    };

    // --- hook history.pushState / replaceState
    ["pushState", "replaceState"].forEach((key) => {
      const original = history[key];
      history[key] = function () {
        const result = original.apply(this, arguments);
        queueMicrotask(notifyIfChanged);
        return result;
      };
    });

    // --- listen to browser back/forward
    window.addEventListener("popstate", notifyIfChanged);

    // --- fallback: detect SPA navigations via DOM mutations
    new MutationObserver(() => {
      queueMicrotask(notifyIfChanged);
    }).observe(document.body, {
      childList: true,
      subtree: true,
    });

    // --- fallback: URL polling
    startUrlPolling(notifyIfChanged);
  }

  async function init() {
    // --- prevent duplicate init
    if (state.initRunning) return;
    state.initRunning = true;

    try {
      // -- reset per-navigation state
      state.currentTierNo = null;
      state.subscribeInfo = null;

      // --- skip if not supported page
      const context = getPageContext();
      if (!context) return;

      // --- bind subscribe button
      let btn = await awaitSubscribedBtn();
      bindBtn(btn);

      // --- retry once listener is attached to the final node
      setTimeout(async () => {
        if (!btn?.isConnected) {
          btn = await awaitSubscribedBtn();
          bindBtn(btn);
        }
      }, 500);

      // --- load supscription info
      state.subscribeInfo = await getSubscribeInfo();

      // --- load lazy popup
      if (state.isPopup) {
        const container = SELECTORS.subscribeContainer;
        if (container) modifyContainer(container);
      }
    } finally {
      state.initRunning = false;
    }
  }

  // --- initialize init with SPA lifecycle hooks
  hookSpaLifecycle(init);
  init();
})();
