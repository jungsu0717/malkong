// 릴스 영상 만들기 — reel/01~12.png(1080×1920)를 천천히 당기며 넘기는 mp4.
// ffmpeg 없이 macOS 기본 AVFoundation 으로 만든다. 사용: swiftc -O make-reel.swift -o /tmp/make-reel && /tmp/make-reel
import AVFoundation
import CoreGraphics
import Foundation
import ImageIO

let W = 1080, H = 1920, FPS: Int32 = 30
let dir = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let outURL = dir.appendingPathComponent("out/reel.mp4")

/// 컷마다 보여 줄 초 — 글이 많은 컷은 길게
let seconds: [Double] = [3.0, 3.0, 3.6, 3.0, 3.6, 3.6, 4.2, 3.8, 4.6, 3.6, 4.2, 4.4]
/// 들어올 때 흔들리는 컷 (멘붕 · 속았다 · 또 처음부터)
let shake: Set<Int> = [2, 5, 8]
let fade = 0.3

func load(_ i: Int) -> CGImage {
  let url = dir.appendingPathComponent(String(format: "reel/%02d.png", i + 1))
  guard let src = CGImageSourceCreateWithURL(url as CFURL, nil), let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else {
    fatalError("이미지를 못 읽었어요: \(url.path)")
  }
  return img
}
let images = (0..<12).map(load)

try? FileManager.default.removeItem(at: outURL)
let writer = try AVAssetWriter(outputURL: outURL, fileType: .mp4)
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
  AVVideoCodecKey: AVVideoCodecType.h264,
  AVVideoWidthKey: W,
  AVVideoHeightKey: H,
  AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 5_000_000, AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel],
])
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB,
  kCVPixelBufferWidthKey as String: W,
  kCVPixelBufferHeightKey as String: H,
])
writer.add(input)
writer.startWriting()
writer.startSession(atSourceTime: .zero)

/// 한 컷을 그린다 — t 는 그 컷 안에서 지난 초. 1.0 → 1.04 로 천천히 당기고, 흔들 컷은 처음 0.5초 동안 떤다
func draw(_ ctx: CGContext, _ i: Int, _ t: Double, alpha: CGFloat) {
  let d = seconds[i]
  let zoom = 1.0 + 0.04 * min(1, t / d)
  var dx = 0.0, dy = 0.0
  if shake.contains(i) && t > 0.1 && t < 0.6 {
    let k = (0.6 - t) / 0.5
    dx = sin(t * 90) * 12 * k
    dy = cos(t * 70) * 8 * k
  }
  let w = Double(W) * zoom, h = Double(H) * zoom
  let rect = CGRect(x: (Double(W) - w) / 2 + dx, y: (Double(H) - h) / 2 + dy, width: w, height: h)
  ctx.saveGState()
  ctx.setAlpha(alpha)
  ctx.draw(images[i], in: rect)
  ctx.restoreGState()
}

let starts = seconds.reduce(into: [0.0]) { $0.append($0.last! + $1) }
let total = starts.last!
let frames = Int(total * Double(FPS))

for f in 0..<frames {
  while !input.isReadyForMoreMediaData { usleep(2000) }
  let time = Double(f) / Double(FPS)
  let i = max(0, min(11, (starts.lastIndex { $0 <= time } ?? 0)))
  var buffer: CVPixelBuffer?
  CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &buffer)
  guard let pb = buffer else { fatalError("버퍼를 못 만들었어요") }
  CVPixelBufferLockBaseAddress(pb, [])
  let ctx = CGContext(
    data: CVPixelBufferGetBaseAddress(pb), width: W, height: H, bitsPerComponent: 8,
    bytesPerRow: CVPixelBufferGetBytesPerRow(pb), space: CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue)!
  ctx.interpolationQuality = .high
  let t = time - starts[i]
  // 다음 컷으로 넘어가기 직전 0.3초는 겹쳐서 넘긴다
  draw(ctx, i, t, alpha: 1)
  let left = starts[i + 1] - time
  if i < 11 && left < fade {
    draw(ctx, i + 1, 0, alpha: CGFloat(1 - left / fade))
  }
  CVPixelBufferUnlockBaseAddress(pb, [])
  adaptor.append(pb, withPresentationTime: CMTime(value: CMTimeValue(f), timescale: FPS))
}

input.markAsFinished()
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()
print(writer.status == .completed ? "out/reel.mp4 (\(String(format: "%.1f", total))초)" : "실패: \(String(describing: writer.error))")
