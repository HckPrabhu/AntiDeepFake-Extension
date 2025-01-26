let isScanning = false
let videoElements = []

function startScan() {
  isScanning = true
  videoElements = Array.from(document.getElementsByTagName("video"))
  videoElements.forEach((video) => {
    video.addEventListener("play", onVideoPlay)
    if (!video.paused) {
      onVideoPlay({ target: video })
    }
  })
}

function stopScan() {
  isScanning = false
  videoElements.forEach((video) => {
    video.removeEventListener("play", onVideoPlay)
  })
}

function onVideoPlay(event) {
  const video = event.target
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")

  function processFrame() {
    if (!isScanning || video.paused || video.ended) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const imageData = canvas.toDataURL("image/jpeg")

    chrome.runtime.sendMessage({ action: "analyzeFrame", frame: imageData }, (response) => {
      updateVideoOverlay(video, response)
      requestAnimationFrame(processFrame)
    })
  }

  requestAnimationFrame(processFrame)
}

function updateVideoOverlay(video, results) {
  let overlay = video.nextElementSibling
  if (!overlay || !overlay.classList.contains("video-analysis-overlay")) {
    overlay = document.createElement("div")
    overlay.classList.add("video-analysis-overlay")
    overlay.style.position = "absolute"
    overlay.style.top = `${video.offsetTop}px`
    overlay.style.left = `${video.offsetLeft}px`
    overlay.style.width = `${video.offsetWidth}px`
    overlay.style.height = `${video.offsetHeight}px`
    overlay.style.pointerEvents = "none"
    video.parentNode.insertBefore(overlay, video.nextSibling)
  }

  overlay.innerHTML = ""

  const canvas = document.createElement("canvas")
  canvas.width = video.offsetWidth
  canvas.height = video.offsetHeight
  const ctx = canvas.getContext("2d")

  // Draw detection results
  drawDetectionOverlay(ctx, results)

  overlay.appendChild(canvas)
}

function drawDetectionOverlay(ctx, results) {
  // Draw pose keypoints
  if (results.pose.length > 0) {
    drawPose(ctx, results.pose[0])
  }

  // Draw YOLO bounding boxes
  results.yolo.forEach((box) => {
    drawBoundingBox(ctx, box, "yellow")
  })

  // Draw object detection results
  results.objectDetection.forEach((obj, index) => {
    ctx.fillStyle = "white"
    ctx.font = "12px Arial"
    ctx.fillText(`${obj.class}: ${obj.score.toFixed(2)}`, 10, 20 + index * 20)
  })

  // Draw deepfake indicator
  if (results.deepfake.isFake) {
    ctx.fillStyle = "rgba(255, 0, 0, 0.5)"
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  }
}

function drawPose(ctx, pose) {
  // Draw keypoints
  pose.keypoints.forEach((keypoint) => {
    ctx.beginPath()
    ctx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI)
    ctx.fillStyle = "red"
    ctx.fill()
  })

  // Draw skeleton
  const edges = [
    ["nose", "left_eye"],
    ["nose", "right_eye"],
    ["left_eye", "left_ear"],
    ["right_eye", "right_ear"],
    ["left_shoulder", "right_shoulder"],
    ["left_shoulder", "left_elbow"],
    ["right_shoulder", "right_elbow"],
    ["left_elbow", "left_wrist"],
    ["right_elbow", "right_wrist"],
    ["left_shoulder", "left_hip"],
    ["right_shoulder", "right_hip"],
    ["left_hip", "right_hip"],
    ["left_hip", "left_knee"],
    ["right_hip", "right_knee"],
    ["left_knee", "left_ankle"],
    ["right_knee", "right_ankle"],
  ]

  edges.forEach(([a, b]) => {
    const pointA = pose.keypoints.find((k) => k.name === a)
    const pointB = pose.keypoints.find((k) => k.name === b)
    if (pointA && pointB) {
      ctx.beginPath()
      ctx.moveTo(pointA.x, pointA.y)
      ctx.lineTo(pointB.x, pointB.y)
      ctx.strokeStyle = "white"
      ctx.lineWidth = 2
      ctx.stroke()
    }
  })
}

function drawBoundingBox(ctx, box, color) {
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.strokeRect(box.x, box.y, box.width, box.height)

  ctx.fillStyle = color
  ctx.font = "12px Arial"
  ctx.fillText(`${box.class}: ${box.score.toFixed(2)}`, box.x, box.y - 5)
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "startScan") {
    startScan()
  } else if (request.action === "stopScan") {
    stopScan()
  }
})

