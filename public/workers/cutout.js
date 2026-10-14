// قص الخلفية داخل المتصفح — Web Worker (module). الموديل ينزل مرة وحدة ويتخزن بكاش المتصفح.
//   • BiRefNet-lite (نفس الموديل اللي تستخدمه مهارة guzeleser-post كبوابة) على WebGPU لما الكرت يدعمه (≥17 storage buffer)
//   • MODNet (Apache-2.0، للأشخاص) على WASM كاحتياط — BiRefNet ثابت على 1024px وما يكفيه ذاكرة WASM
// الأدق دايماً: القص المحلي بسكربت المهارة (فوتوشوب + BiRefNet) — الموقع يستخدمه تلقائياً لو متاح.
import { AutoModel, AutoProcessor, RawImage, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0';

env.allowLocalModels = false;
const forceLite = new URL(self.location.href).searchParams.get('device') === 'wasm';
let ready = null;

async function pick() {
  if (forceLite) return { id: 'Xenova/modnet', name: 'modnet', device: 'wasm', dtype: 'q8', input: 'input' };
  try {
    const ad = self.navigator.gpu ? await self.navigator.gpu.requestAdapter() : null;
    if (ad && ad.limits.maxStorageBuffersPerShaderStage >= 17)
      return { id: 'onnx-community/BiRefNet_lite-ONNX', name: 'birefnet-lite', device: 'webgpu', dtype: 'fp16', input: 'input_image' };
  } catch (e) { /* */ }
  return { id: 'Xenova/modnet', name: 'modnet', device: 'wasm', dtype: 'q8', input: 'input' };
}

async function load() {
  if (ready) return ready;
  ready = (async () => {
    const m = await pick();
    if (m.device === 'wasm' && self.crossOriginIsolated)
      env.backends.onnx.wasm.numThreads = Math.min(8, self.navigator.hardwareConcurrency || 4);
    const progress_callback = p => {
      if (p.status === 'progress' && p.file && p.file.endsWith('.onnx'))
        self.postMessage({ type: 'progress', pct: Math.round(p.progress || 0), device: m.name + '/' + m.device });
    };
    const model = await AutoModel.from_pretrained(m.id, { dtype: m.dtype, device: m.device, progress_callback });
    const processor = await AutoProcessor.from_pretrained(m.id);
    return { model, processor, m };
  })();
  ready.catch(() => { ready = null; });
  return ready;
}

self.onmessage = async ev => {
  const { id, blob } = ev.data;
  try {
    const image = await RawImage.fromBlob(blob);
    const { model, processor, m } = await load();
    const { pixel_values } = await processor(image);
    let out;
    try { out = await model({ [m.input]: pixel_values }); }
    catch (e) { throw new Error((m.device === 'webgpu' ? 'WEBGPU_FAIL: ' : '') + ((e && e.message) || e)); }
    const vals = Object.values(out);
    let t = out.output_image || out.output || vals[vals.length - 1];
    t = m.name === 'birefnet-lite' ? t[0].sigmoid() : t[0];       // MODNet يرجع matte جاهز 0..1
    const mask = await RawImage.fromTensor(t.mul(255).to('uint8')).resize(image.width, image.height);
    const data = new Uint8ClampedArray(mask.data.length / (mask.channels || 1));
    for (let i = 0, c = mask.channels || 1; i < data.length; i++) data[i] = mask.data[i * c];
    self.postMessage({ type: 'done', id, w: mask.width, h: mask.height, mask: data, device: m.name + '/' + m.device }, [data.buffer]);
  } catch (e) {
    self.postMessage({ type: 'error', id, message: String((e && e.message) || e) });
  }
};
