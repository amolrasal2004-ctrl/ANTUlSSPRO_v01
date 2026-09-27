/**
 * ANTU LSS PRO — Interactive Landing Page Script
 * - Interactive TradingView Candlestick Canvas Simulator
 * - Setup State Machine (SSL/BSL Sweeps, FVG 50% Midpoint, TP/SL Boxes)
 * - FAQ Accordion
 * - Checkout Modal Handling
 * - Mobile Navigation
 */

document.addEventListener('DOMContentLoaded', () => {
  initSimulator();
  initFAQ();
  initModal();
  initMobileNav();
});

/* ==========================================================================
   INTERACTIVE TRADINGVIEW CANDLESTICK SIMULATOR
   ========================================================================== */
function initSimulator() {
  const canvas = document.getElementById('tradingview-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const btnLong = document.getElementById('sim-btn-long');
  const btnShort = document.getElementById('sim-btn-short');
  const btnReset = document.getElementById('sim-btn-reset');
  const alertToast = document.getElementById('sim-alert-toast');
  const alertBody = document.getElementById('sim-alert-body');
  const explanationText = document.getElementById('sim-explanation-text');
  
  // HUD Elements
  const hudBias = document.getElementById('hud-bias');
  const hudWr = document.getElementById('hud-wr');
  const hudWl = document.getElementById('hud-wl');

  // Timeline Chips
  const chip1 = document.getElementById('chip-step-1');
  const chip2 = document.getElementById('chip-step-2');
  const chip3 = document.getElementById('chip-step-3');
  const chip4 = document.getElementById('chip-step-4');

  let currentMode = 'long'; // 'long' or 'short'
  let animStep = 0;
  let animTimer = null;

  // Candle Data for Bullish (SSL Sweep) Setup
  // Format: [open, high, low, close, timeStr]
  const longCandles = [
    { o: 24540, h: 24555, l: 24530, c: 24545 }, // 0
    { o: 24545, h: 24550, l: 24520, c: 24525 }, // 1
    { o: 24525, h: 24535, l: 24490, c: 24495 }, // 2: Pivot Low (SSL Level: 24490)
    { o: 24495, h: 24530, l: 24492, c: 24525 }, // 3
    { o: 24525, h: 24540, l: 24510, c: 24535 }, // 4
    { o: 24535, h: 24545, l: 24515, c: 24520 }, // 5
    { o: 24520, h: 24525, l: 24495, c: 24505 }, // 6
    { o: 24505, h: 24515, l: 24475, c: 24500 }, // 7: Sweep Candle (Low 24475 < 24490, Close 24500 > 24490) -> SSL▲
    { o: 24500, h: 24535, l: 24498, c: 24530 }, // 8: Displacement 1
    { o: 24530, h: 24565, l: 24525, c: 24560 }, // 9: Displacement 2
    { o: 24560, h: 24575, l: 24540, c: 24565 }, // 10: Displacement 3 (Bullish FVG: Low 24540 > High 24535 of candle 8... wait let's make gap clean!)
    { o: 24565, h: 24568, l: 24520, c: 24535 }, // 11: Retest Candle tests 50% midpoint (24520) -> ENTRY!
    { o: 24535, h: 24580, l: 24530, c: 24575 }, // 12: Rally toward TP
    { o: 24575, h: 24615, l: 24570, c: 24610 }  // 13: Reaches TP 24609 (Win!)
  ];

  // Specific FVG bounds for long: Top = 24538, Bot = 24502, Mid = 24520
  // SSL Level = 24490, Sweep Low = 24475, SL = 24475 - ATR(10) = 24465, TP = 24520 + (55 * 2) = 24630

  // Candle Data for Bearish (BSL Sweep) Setup
  const shortCandles = [
    { o: 24480, h: 24495, l: 24470, c: 24485 }, // 0
    { o: 24485, h: 24520, l: 24480, c: 24515 }, // 1
    { o: 24515, h: 24560, l: 24510, c: 24555 }, // 2: Pivot High (BSL Level: 24560)
    { o: 24555, h: 24558, l: 24520, c: 24525 }, // 3
    { o: 24525, h: 24540, l: 24515, c: 24530 }, // 4
    { o: 24530, h: 24550, l: 24525, c: 24545 }, // 5
    { o: 24545, h: 24555, l: 24535, c: 24540 }, // 6
    { o: 24540, h: 24575, l: 24530, c: 24545 }, // 7: Sweep Candle (High 24575 > 24560, Close 24545 < 24560) -> BSL▼
    { o: 24545, h: 24548, l: 24505, c: 24510 }, // 8: Bearish Displacement 1
    { o: 24510, h: 24512, l: 24460, c: 24465 }, // 9: Bearish Displacement 2
    { o: 24465, h: 24470, l: 24430, c: 24440 }, // 10: Bearish Displacement 3
    { o: 24440, h: 24500, l: 24438, c: 24485 }, // 11: Retest Candle tests 50% midpoint (24495) -> SHORT ENTRY!
    { o: 24485, h: 24490, l: 24420, c: 24425 }, // 12: Drop toward TP
    { o: 24425, h: 24430, l: 24360, c: 24365 }  // 13: Reaches TP (Win!)
  ];

  function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    renderChart();
  }

  window.addEventListener('resize', resizeCanvas);

  function startSimulation(mode) {
    currentMode = mode;
    animStep = 0;
    if (animTimer) clearInterval(animTimer);

    if (alertToast) alertToast.classList.remove('show');
    resetTimeline();

    // Mode UI Updates
    if (mode === 'long') {
      btnLong.classList.add('active');
      btnShort.classList.remove('active');
      hudBias.textContent = 'Bullish ▲';
      hudBias.className = 'hud-val text-green';
    } else {
      btnShort.classList.add('active');
      btnLong.classList.remove('active');
      hudBias.textContent = 'Bearish ▼';
      hudBias.className = 'hud-val text-red';
    }

    renderChart();

    // Progression Timer
    animTimer = setInterval(() => {
      animStep++;
      updateStepUI(animStep);
      renderChart();

      if (animStep >= 4) {
        clearInterval(animTimer);
        triggerAlertNotification(currentMode);
      }
    }, 1100);
  }

  function resetTimeline() {
    [chip1, chip2, chip3, chip4].forEach(c => {
      if (c) c.classList.remove('active');
    });
    if (chip1) chip1.classList.add('active');
  }

  function updateStepUI(step) {
    if (step === 1) {
      if (chip1) chip1.classList.add('active');
      explanationText.innerHTML = currentMode === 'long' 
        ? `<strong>Stage 1:</strong> Detected historical Pivot Low. Stored in Sell-Side Liquidity (SSL) memory queue at ₹24,490.`
        : `<strong>Stage 1:</strong> Detected historical Pivot High. Stored in Buy-Side Liquidity (BSL) memory queue at ₹24,560.`;
    } else if (step === 2) {
      if (chip2) chip2.classList.add('active');
      explanationText.innerHTML = currentMode === 'long'
        ? `<strong>Stage 2:</strong> Liquidity Sweep Confirmed! Candle wicked down to ₹24,475 but closed inside at ₹24,500. Label <strong>"SSL▲"</strong> plotted.`
        : `<strong>Stage 2:</strong> Liquidity Sweep Confirmed! Candle wicked up to ₹24,575 but closed inside at ₹24,545. Label <strong>"BSL▼"</strong> plotted.`;
    } else if (step === 3) {
      if (chip3) chip3.classList.add('active');
      explanationText.innerHTML = currentMode === 'long'
        ? `<strong>Stage 3:</strong> Institutional Displacement prints a 3-bar Bullish Fair Value Gap (FVG). Midpoint (50% Consequent Encroachment) mapped at ₹24,520.`
        : `<strong>Stage 3:</strong> Institutional Displacement prints a 3-bar Bearish Fair Value Gap (FVG). Midpoint (50% Consequent Encroachment) mapped at ₹24,495.`;
    } else if (step >= 4) {
      if (chip4) chip4.classList.add('active');
      explanationText.innerHTML = currentMode === 'long'
        ? `<strong>Stage 4:</strong> Retest hits 50% midpoint! Dashed Entry line drawn, Red ATR-buffered SL placed at ₹24,465, Green 2.0R Take-Profit target plotted at ₹24,630.`
        : `<strong>Stage 4:</strong> Retest hits 50% midpoint! Dashed Entry line drawn, Red ATR-buffered SL placed at ₹24,585, Green 2.0R Take-Profit target plotted at ₹24,315.`;
    }
  }

  function triggerAlertNotification(mode) {
    if (!alertToast) return;
    if (mode === 'long') {
      alertBody.innerHTML = `<code>{"action":"BUY","signal":"LONG","indicator":"ANTU LSS PRO","ticker":"NIFTY","exchange":"NSE","interval":"5","entry":24520.00,"sl":24465.00,"tp":24630.00}</code>`;
    } else {
      alertBody.innerHTML = `<code>{"action":"SELL","signal":"SHORT","indicator":"ANTU LSS PRO","ticker":"NIFTY","exchange":"NSE","interval":"5","entry":24495.00,"sl":24585.00,"tp":24315.00}</code>`;
    }
    alertToast.classList.add('show');
  }

  function renderChart() {
    const w = canvas.parentElement.getBoundingClientRect().width;
    const h = 420;

    ctx.clearRect(0, 0, w, h);

    // Grid lines & styling
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;

    // Horizontal grid
    for (let y = 40; y < h - 40; y += 45) {
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(w - 75, y);
      ctx.stroke();
    }

    // Vertical grid
    for (let x = 60; x < w - 75; x += 65) {
      ctx.beginPath();
      ctx.moveTo(x, 25);
      ctx.lineTo(x, h - 35);
      ctx.stroke();
    }

    // Price scaling
    const candles = currentMode === 'long' ? longCandles : shortCandles;
    let minPrice = Infinity;
    let maxPrice = -Infinity;

    candles.forEach(c => {
      if (c.l < minPrice) minPrice = c.l;
      if (c.h > maxPrice) maxPrice = c.h;
    });

    // Add margin
    const pMargin = (maxPrice - minPrice) * 0.18;
    const chartMin = minPrice - pMargin;
    const chartMax = maxPrice + pMargin;

    function getY(price) {
      return (h - 60) - ((price - chartMin) / (chartMax - chartMin)) * (h - 100);
    }

    // Visible candles count based on animStep
    let visibleCount = candles.length;
    if (animStep === 0) visibleCount = 6;
    else if (animStep === 1) visibleCount = 7;
    else if (animStep === 2) visibleCount = 8;
    else if (animStep === 3) visibleCount = 11;
    else visibleCount = candles.length;

    const startX = 65;
    const candleSpacing = (w - 170) / (candles.length - 1);
    const candleWidth = Math.max(8, candleSpacing * 0.58);

    // Draw Price Axis on Right
    ctx.fillStyle = '#64748b';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'right';

    for (let y = 45; y < h - 40; y += 45) {
      const priceVal = chartMax - ((y - 20) / (h - 100)) * (chartMax - chartMin);
      ctx.fillText(priceVal.toFixed(0), w - 15, y + 3);
    }

    // Draw Candles up to visibleCount
    for (let i = 0; i < visibleCount; i++) {
      const c = candles[i];
      const cx = startX + i * candleSpacing;
      const isGreen = c.c >= c.o;
      const bodyColor = isGreen ? '#10b981' : '#ef4444';
      const wickColor = isGreen ? '#34d399' : '#f87171';

      const yO = getY(c.o);
      const yC = getY(c.c);
      const yH = getY(c.h);
      const yL = getY(c.l);

      // Wick
      ctx.strokeStyle = wickColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, yH);
      ctx.lineTo(cx, yL);
      ctx.stroke();

      // Body
      ctx.fillStyle = bodyColor;
      const topY = Math.min(yO, yC);
      const bodyHeight = Math.max(2, Math.abs(yC - yO));
      ctx.fillRect(cx - candleWidth / 2, topY, candleWidth, bodyHeight);
    }

    // DRAW ANNOTATIONS ACCORDING TO CURRENT MODE & STEP

    if (currentMode === 'long') {
      // 1. SSL Liquidity Level Line
      if (animStep >= 1) {
        const sslPrice = 24490;
        const sslY = getY(sslPrice);
        const pivotX = startX + 2 * candleSpacing;
        const lineEndX = startX + 7.5 * candleSpacing;

        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(pivotX, sslY);
        ctx.lineTo(lineEndX, sslY);
        ctx.stroke();
        ctx.setLineDash([]);

        // SSL Badge
        ctx.fillStyle = '#06b6d4';
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('SSL 24,490', pivotX + 6, sslY - 6);
      }

      // 2. Sweep Marker Label: SSL▲
      if (animStep >= 2) {
        const sweepX = startX + 7 * candleSpacing;
        const sweepLowY = getY(longCandles[7].l);

        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.roundRect(sweepX - 22, sweepLowY + 8, 44, 18, 4);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SSL ▲', sweepX, sweepLowY + 21);
      }

      // 3. FVG Imbalance Zone
      if (animStep >= 3) {
        const fvgTop = 24538;
        const fvgBot = 24502;
        const fvgMid = (fvgTop + fvgBot) / 2; // 24520

        const yTop = getY(fvgTop);
        const yBot = getY(fvgBot);
        const yMid = getY(fvgMid);

        const xStart = startX + 9 * candleSpacing;
        const xEnd = startX + 13.5 * candleSpacing;

        // Shaded Box
        ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
        ctx.lineWidth = 1;
        ctx.fillRect(xStart, yTop, xEnd - xStart, yBot - yTop);
        ctx.strokeRect(xStart, yTop, xEnd - xStart, yBot - yTop);

        // FVG Label
        ctx.fillStyle = '#34d399';
        ctx.font = '9px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Bullish FVG Zone', xStart + 6, yTop + 14);

        // Midpoint Line
        ctx.strokeStyle = '#f59e0b';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(xStart, yMid);
        ctx.lineTo(xEnd, yMid);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 8.5px JetBrains Mono, monospace';
        ctx.fillText('50% Mid: 24,520', xStart + 6, yMid - 4);
      }

      // 4. Trade Execution (Entry, SL Box, TP Box)
      if (animStep >= 4) {
        const entryPrice = 24520;
        const slPrice = 24465;
        const tpPrice = 24630;

        const yEntry = getY(entryPrice);
        const ySL = getY(slPrice);
        const yTP = getY(tpPrice);

        const xBoxStart = startX + 11 * candleSpacing;
        const xBoxEnd = startX + 13.8 * candleSpacing;
        const boxW = xBoxEnd - xBoxStart;

        // Green TP Box
        ctx.fillStyle = 'rgba(16, 185, 129, 0.22)';
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.2;
        ctx.fillRect(xBoxStart, yTP, boxW, yEntry - yTP);
        ctx.strokeRect(xBoxStart, yTP, boxW, yEntry - yTP);

        ctx.fillStyle = '#34d399';
        ctx.font = 'bold 9px JetBrains Mono, monospace';
        ctx.textAlign = 'right';
        ctx.fillText('TP 24,630 (+2.0R)', xBoxEnd - 6, yTP + 14);

        // Red SL Box
        ctx.fillStyle = 'rgba(239, 68, 68, 0.22)';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.2;
        ctx.fillRect(xBoxStart, yEntry, boxW, ySL - yEntry);
        ctx.strokeRect(xBoxStart, yEntry, boxW, ySL - yEntry);

        ctx.fillStyle = '#f87171';
        ctx.fillText('SL 24,465 (ATR Buf)', xBoxEnd - 6, ySL - 6);

        // Dashed White Entry Line
        ctx.strokeStyle = '#ffffff';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(xBoxStart, yEntry);
        ctx.lineTo(xBoxEnd, yEntry);
        ctx.stroke();
        ctx.setLineDash([]);

        // Long Signal Label
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(xBoxStart - 8, yEntry - 10, 68, 20, 4);
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('▶ LONG', xBoxStart + 26, yEntry + 4);
      }

    } else {
      // BEARISH SHORT SETUP ANNOTATIONS
      // 1. BSL Level Line
      if (animStep >= 1) {
        const bslPrice = 24560;
        const bslY = getY(bslPrice);
        const pivotX = startX + 2 * candleSpacing;
        const lineEndX = startX + 7.5 * candleSpacing;

        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(pivotX, bslY);
        ctx.lineTo(lineEndX, bslY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#f43f5e';
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('BSL 24,560', pivotX + 6, bslY - 6);
      }

      // 2. BSL Sweep Label
      if (animStep >= 2) {
        const sweepX = startX + 7 * candleSpacing;
        const sweepHighY = getY(shortCandles[7].h);

        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.roundRect(sweepX - 22, sweepHighY - 26, 44, 18, 4);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('BSL ▼', sweepX, sweepHighY - 13);
      }

      // 3. Bearish FVG Zone
      if (animStep >= 3) {
        const fvgTop = 24510;
        const fvgBot = 24470;
        const fvgMid = 24490;

        const yTop = getY(fvgTop);
        const yBot = getY(fvgBot);
        const yMid = getY(fvgMid);

        const xStart = startX + 9 * candleSpacing;
        const xEnd = startX + 13.5 * candleSpacing;

        ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.lineWidth = 1;
        ctx.fillRect(xStart, yTop, xEnd - xStart, yBot - yTop);
        ctx.strokeRect(xStart, yTop, xEnd - xStart, yBot - yTop);

        ctx.fillStyle = '#f87171';
        ctx.font = '9px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Bearish FVG Zone', xStart + 6, yBot - 8);

        ctx.strokeStyle = '#f59e0b';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(xStart, yMid);
        ctx.lineTo(xEnd, yMid);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 8.5px JetBrains Mono, monospace';
        ctx.fillText('50% Mid: 24,490', xStart + 6, yMid - 4);
      }

      // 4. Short Trade Execution
      if (animStep >= 4) {
        const entryPrice = 24490;
        const slPrice = 24585;
        const tpPrice = 24310;

        const yEntry = getY(entryPrice);
        const ySL = getY(slPrice);
        const yTP = getY(tpPrice);

        const xBoxStart = startX + 11 * candleSpacing;
        const xBoxEnd = startX + 13.8 * candleSpacing;
        const boxW = xBoxEnd - xBoxStart;

        // Red SL Box
        ctx.fillStyle = 'rgba(239, 68, 68, 0.22)';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.2;
        ctx.fillRect(xBoxStart, ySL, boxW, yEntry - ySL);
        ctx.strokeRect(xBoxStart, ySL, boxW, yEntry - ySL);

        ctx.fillStyle = '#f87171';
        ctx.font = 'bold 9px JetBrains Mono, monospace';
        ctx.textAlign = 'right';
        ctx.fillText('SL 24,585 (ATR Buf)', xBoxEnd - 6, ySL + 14);

        // Green TP Box
        ctx.fillStyle = 'rgba(16, 185, 129, 0.22)';
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.2;
        ctx.fillRect(xBoxStart, yEntry, boxW, yTP - yEntry);
        ctx.strokeRect(xBoxStart, yEntry, boxW, yTP - yEntry);

        ctx.fillStyle = '#34d399';
        ctx.fillText('TP 24,310 (+2.0R)', xBoxEnd - 6, yTP - 6);

        // Dashed White Entry Line
        ctx.strokeStyle = '#ffffff';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(xBoxStart, yEntry);
        ctx.lineTo(xBoxEnd, yEntry);
        ctx.stroke();
        ctx.setLineDash([]);

        // Short Signal Label
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(xBoxStart - 8, yEntry - 10, 72, 20, 4);
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('▶ SHORT', xBoxStart + 28, yEntry + 4);
      }
    }
  }

  // Button Listeners
  if (btnLong) {
    btnLong.addEventListener('click', () => startSimulation('long'));
  }
  if (btnShort) {
    btnShort.addEventListener('click', () => startSimulation('short'));
  }
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (animTimer) clearInterval(animTimer);
      animStep = 0;
      if (alertToast) alertToast.classList.remove('show');
      resetTimeline();
      explanationText.innerHTML = `<strong>Current State:</strong> Simulation reset. Click <em>"Run Bullish Setup"</em> or <em>"Run Bearish Setup"</em> to restart.`;
      renderChart();
    });
  }

  // Initial load
  resizeCanvas();
  startSimulation('long');
}

/* ==========================================================================
   FAQ ACCORDION
   ========================================================================== */
function initFAQ() {
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');

    question.addEventListener('click', () => {
      const isOpen = item.classList.contains('active');

      // Close all other items
      faqItems.forEach(other => {
        if (other !== item) {
          other.classList.remove('active');
          const otherAns = other.querySelector('.faq-answer');
          if (otherAns) otherAns.style.maxHeight = null;
          other.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
        }
      });

      // Toggle current
      if (isOpen) {
        item.classList.remove('active');
        answer.style.maxHeight = null;
        question.setAttribute('aria-expanded', 'false');
      } else {
        item.classList.add('active');
        answer.style.maxHeight = answer.scrollHeight + 'px';
        question.setAttribute('aria-expanded', 'true');
      }
    });
  });
}

/* ==========================================================================
   CHECKOUT MODAL
   ========================================================================== */
function initModal() {
  const modal = document.getElementById('checkout-modal');
  const openBtn = document.getElementById('checkout-modal-btn');
  const closeBtn = document.getElementById('modal-close-btn');

  function openModal() {
    if (!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  if (openBtn) {
    openBtn.addEventListener('click', openModal);
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.classList.contains('open')) {
      closeModal();
    }
  });
}

/* ==========================================================================
   MOBILE NAVIGATION
   ========================================================================== */
function initMobileNav() {
  const toggleBtn = document.getElementById('mobile-menu-toggle');
  const navMenu = document.getElementById('site-nav');
  const navLinks = document.querySelectorAll('.nav-link');

  if (toggleBtn && navMenu) {
    toggleBtn.addEventListener('click', () => {
      navMenu.classList.toggle('open');
    });

    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
      });
    });
  }
}
