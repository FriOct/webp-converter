(() => {
  "use strict";

  const MAX_SIZE = 20 * 1024 * 1024; // 20MB, matches the original script's cap
  const MAX_LONG_EDGE = 4000;
  const AUTO_QUALITY_STEPS = []; // 0.95, 0.90, ... 0.10
  for (let q = 95; q >= 10; q -= 5) AUTO_QUALITY_STEPS.push(q / 100);

  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");
  const fileListEl = document.getElementById("fileList");
  const actionsEl = document.getElementById("actions");
  const convertAllBtn = document.getElementById("convertAllBtn");
  const downloadZipBtn = document.getElementById("downloadZipBtn");
  const clearBtn = document.getElementById("clearBtn");
  const qualityMode = document.getElementById("qualityMode");
  const manualQualityRow = document.getElementById("manualQualityRow");
  const qualitySlider = document.getElementById("qualitySlider");
  const qualityValue = document.getElementById("qualityValue");
  const resizeToggle = document.getElementById("resizeToggle");

  /** @type {Array<{
   *  id: number, file: File, name: string, originalSize: number,
   *  status: 'pending'|'working'|'done'|'error', statusText: string,
   *  outputBlob: Blob|null, outputSize: number|null, quality: number|null,
   *  thumbUrl: string, downloadUrl: string|null
   * }>} */
  let entries = [];
  let idCounter = 0;

  function formatSize(bytes) {
    if (bytes == null) return "";
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
  }

  function outputName(name) {
    return name.replace(/\.jpe?g$/i, ".webp");
  }

  // ---- File intake ----

  function addFiles(fileListLike) {
    const files = Array.from(fileListLike).filter((f) =>
      /\.(jpe?g)$/i.test(f.name) || f.type === "image/jpeg"
    );
    if (files.length === 0) return;

    for (const file of files) {
      entries.push({
        id: idCounter++,
        file,
        name: file.name,
        originalSize: file.size,
        status: "pending",
        statusText: "대기 중",
        outputBlob: null,
        outputSize: null,
        quality: null,
        thumbUrl: URL.createObjectURL(file),
        downloadUrl: null,
      });
    }
    render();
  }

  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") fileInput.click();
  });
  fileInput.addEventListener("change", (e) => {
    addFiles(e.target.files);
    fileInput.value = "";
  });

  ["dragenter", "dragover"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    })
  );
  ["dragleave", "drop"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
    })
  );
  dropzone.addEventListener("drop", (e) => {
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  });

  // ---- Controls ----

  qualityMode.addEventListener("change", () => {
    manualQualityRow.hidden = qualityMode.value !== "manual";
  });
  qualitySlider.addEventListener("input", () => {
    qualityValue.textContent = qualitySlider.value;
  });

  // ---- Conversion ----

  async function loadImageBitmap(file) {
    if (window.createImageBitmap) {
      try {
        return await createImageBitmap(file);
      } catch (_) {
        // fall through to <img> based loading (some browsers choke on certain JPEGs)
      }
    }
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      };
      img.src = url;
    });
  }

  function canvasToBlob(canvas, quality) {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/webp", quality);
    });
  }

  async function convertEntry(entry) {
    entry.status = "working";
    entry.statusText = "변환 중...";
    render();

    try {
      const bitmap = await loadImageBitmap(entry.file);
      const srcW = bitmap.width;
      const srcH = bitmap.height;
      const longEdge = Math.max(srcW, srcH);

      let drawW = srcW;
      let drawH = srcH;
      if (resizeToggle.checked && longEdge > MAX_LONG_EDGE) {
        const scale = MAX_LONG_EDGE / longEdge;
        drawW = Math.max(1, Math.round(srcW * scale));
        drawH = Math.max(1, Math.round(srcH * scale));
      }

      const canvas = document.createElement("canvas");
      canvas.width = drawW;
      canvas.height = drawH;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, 0, 0, drawW, drawH);
      if (bitmap.close) bitmap.close();

      let bestBlob = null;
      let bestQuality = null;

      if (qualityMode.value === "manual") {
        const q = Number(qualitySlider.value) / 100;
        bestBlob = await canvasToBlob(canvas, q);
        bestQuality = Math.round(q * 100);
      } else {
        // Try from highest quality down, keep the first one that fits the size cap.
        let lastBlob = null;
        let lastQ = null;
        for (const q of AUTO_QUALITY_STEPS) {
          const blob = await canvasToBlob(canvas, q);
          lastBlob = blob;
          lastQ = q;
          if (blob && blob.size <= MAX_SIZE) {
            bestBlob = blob;
            bestQuality = Math.round(q * 100);
            break;
          }
        }
        if (!bestBlob) {
          // Nothing fit under the cap; fall back to the smallest (lowest quality) attempt.
          bestBlob = lastBlob;
          bestQuality = Math.round(lastQ * 100);
        }
      }

      if (!bestBlob) throw new Error("WEBP 인코딩 실패");

      entry.outputBlob = bestBlob;
      entry.outputSize = bestBlob.size;
      entry.quality = bestQuality;
      entry.downloadUrl = URL.createObjectURL(bestBlob);
      entry.status = "done";
      entry.statusText = "완료";
    } catch (err) {
      console.error(err);
      entry.status = "error";
      entry.statusText = "변환 실패: " + (err?.message || "알 수 없는 오류");
    }
    render();
  }

  convertAllBtn.addEventListener("click", async () => {
    convertAllBtn.disabled = true;
    const targets = entries.filter((e) => e.status === "pending" || e.status === "error");
    for (const entry of targets) {
      await convertEntry(entry);
    }
    convertAllBtn.disabled = false;
    downloadZipBtn.disabled = !entries.some((e) => e.status === "done");
  });

  downloadZipBtn.addEventListener("click", async () => {
    const done = entries.filter((e) => e.status === "done" && e.outputBlob);
    if (done.length === 0) return;
    downloadZipBtn.disabled = true;
    downloadZipBtn.textContent = "압축 중...";
    try {
      const zip = new JSZip();
      for (const entry of done) {
        zip.file(outputName(entry.name), entry.outputBlob);
      }
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = "webp-converted.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } finally {
      downloadZipBtn.disabled = false;
      downloadZipBtn.textContent = "전체 ZIP 다운로드";
    }
  });

  clearBtn.addEventListener("click", () => {
    for (const entry of entries) {
      URL.revokeObjectURL(entry.thumbUrl);
      if (entry.downloadUrl) URL.revokeObjectURL(entry.downloadUrl);
    }
    entries = [];
    render();
  });

  function removeEntry(id) {
    const idx = entries.findIndex((e) => e.id === id);
    if (idx === -1) return;
    const [entry] = entries.splice(idx, 1);
    URL.revokeObjectURL(entry.thumbUrl);
    if (entry.downloadUrl) URL.revokeObjectURL(entry.downloadUrl);
    render();
  }

  // ---- Rendering ----

  function render() {
    actionsEl.hidden = entries.length === 0;
    downloadZipBtn.disabled = !entries.some((e) => e.status === "done");

    fileListEl.innerHTML = "";
    for (const entry of entries) {
      const row = document.createElement("div");
      row.className = "file-row";

      const thumb = document.createElement("img");
      thumb.className = "file-thumb";
      thumb.src = entry.thumbUrl;
      thumb.alt = "";
      row.appendChild(thumb);

      const info = document.createElement("div");
      info.className = "file-info";

      const nameEl = document.createElement("div");
      nameEl.className = "file-name";
      nameEl.textContent = entry.name;
      info.appendChild(nameEl);

      const meta = document.createElement("div");
      meta.className = "file-meta";
      if (entry.status === "done") {
        meta.innerHTML =
          formatSize(entry.originalSize) +
          `<span class="arrow">→</span>` +
          formatSize(entry.outputSize) +
          ` · 품질 ${entry.quality}%`;
      } else {
        meta.textContent = formatSize(entry.originalSize);
      }
      info.appendChild(meta);

      const status = document.createElement("div");
      status.className = "file-status " + entry.status;
      status.textContent = entry.statusText;
      info.appendChild(status);

      row.appendChild(info);

      const actions = document.createElement("div");
      actions.className = "file-actions";

      if (entry.status === "done" && entry.downloadUrl) {
        const link = document.createElement("a");
        link.className = "download-link";
        link.href = entry.downloadUrl;
        link.download = outputName(entry.name);
        link.textContent = "다운로드";
        actions.appendChild(link);
      }

      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-btn";
      removeBtn.setAttribute("aria-label", "제거");
      removeBtn.textContent = "✕";
      removeBtn.addEventListener("click", () => removeEntry(entry.id));
      actions.appendChild(removeBtn);

      row.appendChild(actions);
      fileListEl.appendChild(row);
    }
  }

  render();
})();
