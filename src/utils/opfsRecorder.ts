// Crash-proof OPFS Multi-Track ISO Recorder
// Streams sequential 1s WebM program chunks + uncompressed 16-bit WAV PCM mic chunks directly to OPFS.

export interface OpfsSessionSummary {
  sessionId: string;
  roomCode: string;
  startedAt: number;
  programChunks: number;
  isoChunks: number;
  sampleRate: number;
}

export interface FinalizedOpfsRecording {
  sessionId: string;
  programBlob: Blob;
  programUrl: string;
  isoWavBlob: Blob | null;
  isoWavUrl: string | null;
  durationSec: number;
  chunkCount: number;
}

const ROOT_DIR = 'gather-opfs-recordings';

export function supportsOpfs(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    Boolean(navigator.storage) &&
    typeof navigator.storage.getDirectory === 'function'
  );
}

async function getRecordingsRoot(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(ROOT_DIR, { create: true });
}

function buildWavHeader(dataBytes: number, sampleRate: number, numChannels = 1): Uint8Array {
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataBytes, true);
  return new Uint8Array(buffer);
}

export async function listRecoverableOpfsSessions(): Promise<OpfsSessionSummary[]> {
  if (!supportsOpfs()) return [];
  try {
    const root = await getRecordingsRoot();
    const sessions: OpfsSessionSummary[] = [];
    for await (const [name, handle] of root.entries()) {
      if (handle.kind !== 'directory') continue;
      let programChunks = 0;
      let isoChunks = 0;
      let roomCode = 'LIVE';
      let startedAt = Date.now();
      let sampleRate = 48000;
      try {
        const metaHandle = await (handle as FileSystemDirectoryHandle).getFileHandle('meta.json');
        const metaFile = await metaHandle.getFile();
        const meta = JSON.parse(await metaFile.text()) as Partial<OpfsSessionSummary>;
        if (meta.roomCode) roomCode = meta.roomCode;
        if (meta.startedAt) startedAt = meta.startedAt;
        if (meta.sampleRate) sampleRate = meta.sampleRate;
      } catch {
        // ignore missing meta
      }
      for await (const [fName] of (handle as FileSystemDirectoryHandle).entries()) {
        if (fName.startsWith('pgm-')) programChunks++;
        else if (fName.startsWith('iso-')) isoChunks++;
      }
      if (programChunks > 0) {
        sessions.push({
          sessionId: name,
          roomCode,
          startedAt,
          programChunks,
          isoChunks,
          sampleRate,
        });
      }
    }
    return sessions.sort((a, b) => b.startedAt - a.startedAt);
  } catch {
    return [];
  }
}

export async function assembleOpfsSession(
  sessionId: string
): Promise<FinalizedOpfsRecording | null> {
  if (!supportsOpfs()) return null;
  try {
    const root = await getRecordingsRoot();
    const dir = await root.getDirectoryHandle(sessionId);
    let sampleRate = 48000;
    let startedAt = Date.now();
    try {
      const metaHandle = await dir.getFileHandle('meta.json');
      const meta = JSON.parse(await (await metaHandle.getFile()).text()) as {
        sampleRate?: number;
        startedAt?: number;
      };
      if (meta.sampleRate) sampleRate = meta.sampleRate;
      if (meta.startedAt) startedAt = meta.startedAt;
    } catch {
      // default sampleRate
    }

    const pgmFiles: Array<{ name: string; file: File }> = [];
    const isoFiles: Array<{ name: string; file: File }> = [];
    for await (const [fName, handle] of dir.entries()) {
      if (handle.kind !== 'file') continue;
      if (fName.startsWith('pgm-')) {
        pgmFiles.push({ name: fName, file: await (handle as FileSystemFileHandle).getFile() });
      } else if (fName.startsWith('iso-')) {
        isoFiles.push({ name: fName, file: await (handle as FileSystemFileHandle).getFile() });
      }
    }
    if (pgmFiles.length === 0) return null;

    pgmFiles.sort((a, b) => a.name.localeCompare(b.name));
    isoFiles.sort((a, b) => a.name.localeCompare(b.name));

    const programBlob = new Blob(
      pgmFiles.map((f) => f.file),
      { type: 'video/webm' }
    );
    const programUrl = URL.createObjectURL(programBlob);

    let isoWavBlob: Blob | null = null;
    let isoWavUrl: string | null = null;
    if (isoFiles.length > 0) {
      const totalPcmBytes = isoFiles.reduce((acc, f) => acc + f.file.size, 0);
      if (totalPcmBytes > 0) {
        const header = buildWavHeader(totalPcmBytes, sampleRate, 1);
        isoWavBlob = new Blob([header as BlobPart, ...isoFiles.map((f) => f.file)], {
          type: 'audio/wav',
        });
        isoWavUrl = URL.createObjectURL(isoWavBlob);
      }
    }

    return {
      sessionId,
      programBlob,
      programUrl,
      isoWavBlob,
      isoWavUrl,
      durationSec: Math.max(1, pgmFiles.length, Math.round((Date.now() - startedAt) / 1000)),
      chunkCount: pgmFiles.length,
    };
  } catch {
    return null;
  }
}

export async function deleteOpfsSession(sessionId: string): Promise<void> {
  if (!supportsOpfs()) return;
  try {
    const root = await getRecordingsRoot();
    await root.removeEntry(sessionId, { recursive: true });
  } catch {
    // ignore cleanup error
  }
}

export class OpfsIsoRecorder {
  private sessionId: string;
  private roomCode: string;
  private dirHandle: FileSystemDirectoryHandle | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private pgmIndex = 0;
  private isoIndex = 0;
  private audioCtx: AudioContext | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private pcmBuffer: Int16Array[] = [];
  private pcmSamples = 0;
  private sampleRate = 48000;
  private startedAt = Date.now();
  private memoryPgmChunks: Blob[] = [];
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(roomCode: string) {
    this.roomCode = roomCode;
    this.sessionId = `${roomCode}-${Date.now()}`;
  }

  get id() {
    return this.sessionId;
  }

  async start(programStream: MediaStream, localMicStream: MediaStream | null): Promise<void> {
    this.startedAt = Date.now();

    if (supportsOpfs()) {
      try {
        const root = await getRecordingsRoot();
        this.dirHandle = await root.getDirectoryHandle(this.sessionId, { create: true });
        const metaHandle = await this.dirHandle.getFileHandle('meta.json', { create: true });
        const writable = await metaHandle.createWritable();
        await writable.write(
          JSON.stringify({
            sessionId: this.sessionId,
            roomCode: this.roomCode,
            startedAt: this.startedAt,
            sampleRate: this.sampleRate,
          })
        );
        await writable.close();
      } catch {
        this.dirHandle = null;
      }
    }

    // Start isolated local mic uncompressed 16-bit PCM capture
    if (localMicStream && localMicStream.getAudioTracks().length > 0) {
      try {
        const ctx = new AudioContext();
        this.sampleRate = ctx.sampleRate || 48000;
        const src = ctx.createMediaStreamSource(localMicStream);
        const proc = ctx.createScriptProcessor(4096, 1, 1);
        proc.onaudioprocess = (e) => {
          const input = e.inputBuffer.getChannelData(0);
          const i16 = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]));
            i16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          this.pcmBuffer.push(i16);
          this.pcmSamples += i16.length;
          if (this.pcmSamples >= this.sampleRate) {
            this.flushIsoPcmChunk();
          }
        };
        const silentGain = ctx.createGain();
        silentGain.gain.value = 0;
        src.connect(proc);
        proc.connect(silentGain);
        silentGain.connect(ctx.destination);
        this.audioCtx = ctx;
        this.processorNode = proc;
      } catch {
        // ignore if AudioContext fails
      }
    }

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm';

    const rec = new MediaRecorder(programStream, { mimeType });
    rec.ondataavailable = (ev) => {
      if (ev.data.size > 0) {
        this.memoryPgmChunks.push(ev.data);
        if (this.dirHandle) {
          const idx = String(++this.pgmIndex).padStart(5, '0');
          const chunk = ev.data;
          this.writeQueue = this.writeQueue.then(async () => {
            if (!this.dirHandle) return;
            const fh = await this.dirHandle.getFileHandle(`pgm-${idx}.webm`, { create: true });
            const wr = await fh.createWritable();
            await wr.write(chunk);
            await wr.close();
          });
        }
      }
    };
    rec.start(1000);
    this.mediaRecorder = rec;
  }

  private flushIsoPcmChunk() {
    if (this.pcmBuffer.length === 0 || !this.dirHandle) return;
    const chunks = this.pcmBuffer;
    const totalLen = this.pcmSamples;
    this.pcmBuffer = [];
    this.pcmSamples = 0;

    const merged = new Int16Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }
    const idx = String(++this.isoIndex).padStart(5, '0');
    const bytes = new Uint8Array(merged.buffer);
    this.writeQueue = this.writeQueue.then(async () => {
      if (!this.dirHandle) return;
      const fh = await this.dirHandle.getFileHandle(`iso-${idx}.pcm`, { create: true });
      const wr = await fh.createWritable();
      await wr.write(bytes);
      await wr.close();
    });
  }

  async stop(): Promise<FinalizedOpfsRecording> {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        const rec = this.mediaRecorder!;
        const onStop = () => {
          rec.removeEventListener('stop', onStop);
          resolve();
        };
        rec.addEventListener('stop', onStop);
        rec.stop();
      });
    }

    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }
    if (this.audioCtx) {
      await this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }

    if (this.dirHandle) {
      this.flushIsoPcmChunk();
      await this.writeQueue;
      const assembled = await assembleOpfsSession(this.sessionId);
      if (assembled) {
        return assembled;
      }
    }

    const programBlob = new Blob(this.memoryPgmChunks, { type: 'video/webm' });
    const programUrl = URL.createObjectURL(programBlob);
    let isoWavBlob: Blob | null = null;
    let isoWavUrl: string | null = null;
    if (this.pcmSamples > 0) {
      const merged = new Int16Array(this.pcmSamples);
      let off = 0;
      for (const c of this.pcmBuffer) {
        merged.set(c, off);
        off += c.length;
      }
      const header = buildWavHeader(merged.byteLength, this.sampleRate, 1);
      isoWavBlob = new Blob([header as BlobPart, merged.buffer as BlobPart], {
        type: 'audio/wav',
      });
      isoWavUrl = URL.createObjectURL(isoWavBlob);
    }

    return {
      sessionId: this.sessionId,
      programBlob,
      programUrl,
      isoWavBlob,
      isoWavUrl,
      durationSec: Math.max(1, Math.round((Date.now() - this.startedAt) / 1000)),
      chunkCount: this.memoryPgmChunks.length,
    };
  }
}
