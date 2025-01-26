let isScanning = false
let videoStream = null

document.addEventListener("DOMContentLoaded", () => {
  const startScanButton = document.getElementById("startScan")
  const stopScanButton = document.getElementById("stopScan")
  const videoPreview = document.getElementById("videoPreview")
  const overlayCanvas = document.getElementById("overlayCanvas")
  const notificationElement = document.getElementById("notification")

  startScanButton.addEventListener("click", startScan)
  stopScanButton.addEventListener("click", stopScan)

  function startScan() {
    isScanning = true
    startScanButton.classList.add("hidden")
    stopScanButton.classList.remove("hidden")

    simulateScanResult() // Add this line to start the simulated scan

    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        videoStream = stream
        videoPreview.srcObject = stream
        startVideoAnalysis()
      })
      .catch((error) => {
        showNotification("Webcam access denied. Only page videos will be scanned.", "error")
      })

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "startScan" })
    })
  }

  function stopScan() {
    isScanning = false
    startScanButton.classList.remove("hidden")
    stopScanButton.classList.add("hidden")

    if (videoStream) {
      videoStream.getTracks().forEach((track) => track.stop())
      videoStream = null
    }

    // Reset the simulated scan result
    const simulatedScanResultElement = document.getElementById("simulatedScanResult")
    simulatedScanResultElement.textContent = "Click 'Start Scan' to begin"
    simulatedScanResultElement.className = "text-center text-2xl font-bold"

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "stopScan" })
    })
  }

  function startVideoAnalysis() {
    if (!isScanning) return

    const ctx = overlayCanvas.getContext("2d")
    ctx.drawImage(videoPreview, 0, 0, overlayCanvas.width, overlayCanvas.height)
    const imageData = overlayCanvas.toDataURL("image/jpeg")

    chrome.runtime.sendMessage({ action: "analyzeFrame", frame: imageData }, (response) => {
      updateDetectionResults(response)
      drawDetectionOverlay(ctx, response)
      requestAnimationFrame(startVideoAnalysis)
    })
  }

  function simulateScanResult() {
    const simulatedScanResultElement = document.getElementById("simulatedScanResult")
    simulatedScanResultElement.textContent = "Scanning..."
    simulatedScanResultElement.className = "text-center text-2xl font-bold text-yellow-500"

    setTimeout(() => {
      const random = Math.random()
      let result, className

      if (random < 0.6) {
        result = "Safe"
        className = "text-green-500"
      } else if (random < 0.9) {
        result = "Warning"
        className = "text-yellow-500"
      } else {
        result = "Infected"
        className = "text-red-500"
      }

      simulatedScanResultElement.textContent = result
      simulatedScanResultElement.className = `text-center text-2xl font-bold ${className}`
    }, 5000)
  }

  function updateDetectionResults(results) {
    document.getElementById("deepfakeResult").textContent = results.deepfake.isFake ? "Detected" : "Not Detected"
    document.getElementById("poseResult").textContent = results.pose.length > 0 ? "Detected" : "Not Detected"
    document.getElementById("yoloResult").textContent =
      results.yolo.length > 0 ? `${results.yolo.length} objects` : "None"
    document.getElementById("objectResult").textContent =
      results.objectDetection.length > 0 ? results.objectDetection.map((obj) => obj.class).join(", ") : "None"
  }

  function drawDetectionOverlay(ctx, results) {
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)

    // Draw pose keypoints
    if (results.pose.length > 0) {
      drawPose(ctx, results.pose[0])
    }

    // Draw YOLO bounding boxes
    results.yolo.forEach((box) => {
      drawBoundingBox(ctx, box, "yellow")
    })

    // Draw object detection results
    results.objectDetection.forEach((obj) => {
      ctx.fillStyle = "white"
      ctx.font = "12px Arial"
      ctx.fillText(`${obj.class}: ${obj.score.toFixed(2)}`, 10, 20)
    })

    // Draw deepfake indicator
    if (results.deepfake.isFake) {
      ctx.fillStyle = "rgba(255, 0, 0, 0.5)"
      ctx.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height)
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

  function showNotification(message, type) {
    notificationElement.textContent = message
    notificationElement.className = `fixed bottom-4 right-4 p-2 rounded-lg shadow-lg ${type === "error" ? "bg-red-500" : "bg-blue-500"} text-white`
    notificationElement.classList.remove("hidden")
    setTimeout(() => {
      notificationElement.classList.add("hidden")
    }, 5000)
  }
})

