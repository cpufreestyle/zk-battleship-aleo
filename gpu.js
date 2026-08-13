/**
 * gpu.js — WebGPU 加速 ZK 运算层
 *
 * 策略：
 * 1. 检测 WebGPU 支持 (navigator.gpu)
 * 2. 用 WGSL compute shader 在 GPU 上做 bitwise AND (ships & mask)
 *    — 这正是 verify_hit / verify_victory / verify_scan 的核心运算
 * 3. 对比 GPU vs CPU 耗时，展示加速效果
 * 4. 不支持 WebGPU 时返回 null，调用方 fallback 到 WASM/JS
 *
 * 为什么 WebGPU 能加速 ZK：
 * ZK 证明的核心运算是 FFT (快速傅里叶变换) 和多项式乘法——大规模并行运算。
 * CPU 串行算几百毫秒，GPU 数千核心并行只需几毫秒。
 * 这里用 compute shader 实现最核心的 bitwise AND + popcount，
 * 真正的 snarkVM FFT 需要更复杂的 shader，但原理一致。
 */

let _device = null;
let _pipeline = null;
let _supported = null;

/** 检测 WebGPU 是否可用 */
async function isSupported() {
  if (_supported !== null) return _supported;
  try {
    if (!navigator.gpu) {
      _supported = false;
      return false;
    }
    const adapter = await navigator.gpu.requestAdapter();
    _supported = !!adapter;
    return _supported;
  } catch (e) {
    _supported = false;
    return false;
  }
}

/** 初始化 WebGPU 设备 + compute pipeline */
async function init() {
  if (!await isSupported()) return false;
  if (_device) return true;

  try {
    const adapter = await navigator.gpu.requestAdapter();
    _device = await adapter.requestDevice();

    // WGSL compute shader: 对两个 u32 做 bitwise AND，再 popcount 结果
    // 这就是 verify_hit(ships & mask) 的核心运算
    const shaderCode = /* wgsl */ `
      struct ZKInput {
        ships: u32,
        mask: u32,
      };
      struct ZKOutput {
        result: u32,      // ships & mask
        is_hit: u32,      // result != 0 ? 1 : 0
        popcount: u32,    // number of bits set in result (for scan)
        is_victory: u32,  // result == ships ? 1 : 0 (for victory check)
      };

      @group(0) @binding(0) var<uniform> input: ZKInput;
      @group(0) @binding(1) var<storage, read_write> output: ZKOutput;

      fn popcount_u32(v: u32) -> u32 {
        var x = v;
        x = x - ((x >> 1) & 0x55555555u);
        x = (x & 0x33333333u) + ((x >> 2) & 0x33333333u);
        x = (x + (x >> 4)) & 0x0F0F0F0Fu;
        return (x * 0x01010101u) >> 24;
      }

      @compute @workgroup_size(1)
      fn main() {
        let r = input.ships & input.mask;
        output.result = r;
        output.is_hit = select(0u, 1u, r != 0u);
        output.popcount = popcount_u32(r);
        output.is_victory = select(0u, 1u, r == input.ships);
      }
    `;

    const shaderModule = _device.createShaderModule({ code: shaderCode });

    _pipeline = _device.createComputePipeline({
      layout: "auto",
      compute: { module: shaderModule, entryPoint: "main" },
    });

    console.log("[GPU] WebGPU compute pipeline ready");
    return true;
  } catch (e) {
    console.warn("[GPU] WebGPU init failed:", e.message);
    _device = null;
    _supported = false;
    return false;
  }
}

/**
 * 在 GPU 上执行 bitwise AND 运算
 * @returns { result, isHit, popcount, isVictory, gpuMs } 或 null
 */
async function computeAnd(ships, mask) {
  if (!_device || !_pipeline) return null;

  try {
    const t0 = performance.now();

    // 创建 uniform buffer (2 x u32 = 8 bytes, padded to 16)
    const uniformBuf = _device.createBuffer({
      size: 16, // uniform 要求 16 字节对齐
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // 创建 storage buffer (4 x u32 = 16 bytes)
    const storageBuf = _device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    // 写入输入数据
    const inputData = new ArrayBuffer(16);
    const view = new DataView(inputData);
    view.setUint32(0, ships >>> 0, true);
    view.setUint32(4, mask >>> 0, true);
    _device.queue.writeBuffer(uniformBuf, 0, inputData);

    // dispatch compute
    const encoder = _device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(_pipeline);
    pass.setBindGroup(0, _device.createBindGroup({
      layout: _pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniformBuf } },
        { binding: 1, resource: { buffer: storageBuf } },
      ],
    }));
    pass.dispatchWorkgroups(1);
    pass.end();

    // copy result to mappable buffer
    const readBuf = _device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    encoder.copyBufferToBuffer(storageBuf, 0, readBuf, 0, 16);
    _device.queue.submit([encoder.finish()]);

    // read back
    await readBuf.mapAsync(GPUMapMode.READ);
    const resultData = new Uint32Array(readBuf.getMappedRange());

    const output = {
      result: resultData[0],
      isHit: resultData[1] !== 0,
      popcount: resultData[2],
      isVictory: resultData[3] !== 0,
      gpuMs: Math.round((performance.now() - t0) * 100) / 100,
    };

    // cleanup
    readBuf.unmap();
    uniformBuf.destroy();
    storageBuf.destroy();
    readBuf.destroy();

    return output;
  } catch (e) {
    console.warn("[GPU] compute failed:", e.message);
    return null;
  }
}

/**
 * GPU 加速 verify_hit
 * @returns { isHit, engine, ms } 或 null (fallback)
 */
async function verifyHitGPU(ships, mask) {
  const r = await computeAnd(ships, mask);
  if (!r) return null;
  return { isHit: r.isHit, engine: "WebGPU", ms: r.gpuMs };
}

/**
 * GPU 加速 verify_victory
 * @returns { isVictory, engine, ms } 或 null
 */
async function verifyVictoryGPU(ships, hits) {
  const r = await computeAnd(ships, hits);
  if (!r) return null;
  return { isVictory: r.isVictory, engine: "WebGPU", ms: r.gpuMs };
}

/**
 * GPU 加速 scan (popcount of ships & scanMask)
 * @returns { count, engine, ms } 或 null
 */
async function scanGPU(ships, scanMask) {
  const r = await computeAnd(ships, scanMask);
  if (!r) return null;
  return { count: r.popcount, engine: "WebGPU", ms: r.gpuMs };
}

/**
 * Benchmark: 对比 GPU vs CPU 耗时
 */
async function benchmark(ships, mask) {
  // GPU
  const gpuResult = await computeAnd(ships, mask);
  const gpuMs = gpuResult ? gpuResult.gpuMs : -1;

  // CPU
  const t0 = performance.now();
  const cpuResult = (ships & mask) !== 0;
  const cpuMs = Math.round((performance.now() - t0) * 1000) / 1000;

  return {
    gpuMs,
    cpuMs,
    speedup: gpuMs > 0 ? Math.round(cpuMs / gpuMs * 10) / 10 : 0,
    result: cpuResult,
  };
}

export const ZKGPU = {
  isSupported,
  init,
  verifyHitGPU,
  verifyVictoryGPU,
  scanGPU,
  benchmark,
  get device() { return _device; },
};
