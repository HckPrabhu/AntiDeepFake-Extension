importScripts("tfjs/tf-core.js", "tfjs/tf-converter.js", "tfjs/tf-backend-webgl.js")

const models = {
  deepfake: null,
  pose: null,
  yolo: null,
  objectDetection: null,
}

async function loadModels() {
  const modelPaths = {
    deepfake: "models/efficientnet_b0/model.json",
    pose: "models/posenet/model.json",
    yolo: "models/yolo/model.json",
    objectDetection: "models/mobilenet/model.json",
  }

  for (const [key, path] of Object.entries(modelPaths)) {
    models[key] = await tf.loadGraphModel(chrome.runtime.getURL(path))
    console.log(`${key} model loaded`)
  }
}

loadModels()

async function preprocessImage(imageData) {
  const img = await createImageBitmap(dataURItoBlob(imageData))
  const tensor = tf.browser.fromPixels(img).resizeBilinear([224, 224]).toFloat().div(tf.scalar(255)).expandDims()
  return tensor
}

async function analyzeFrame(imageData) {
  if (!Object.values(models).every((model) => model)) {
    console.log("Not all models are loaded yet")
    return {
      deepfake: { isFake: false, confidence: 0 },
      pose: [],
      yolo: [],
      objectDetection: [],
    }
  }

  const tensor = await preprocessImage(imageData)

  const results = {
    deepfake: await detectDeepfake(tensor),
    pose: await detectPose(tensor),
    yolo: await detectYOLO(tensor),
    objectDetection: await detectObjects(tensor),
  }

  tensor.dispose()
  return results
}

async function detectDeepfake(tensor) {
  const prediction = await models.deepfake.predict(tensor)
  const result = prediction.dataSync()[0]
  prediction.dispose()
  return {
    isFake: result > 0.5,
    confidence: result,
  }
}

async function detectPose(tensor) {
  const prediction = await models.pose.predict(tensor)
  const poses = await movenet.estimatePoses(prediction)
  prediction.dispose()
  return poses
}

async function detectYOLO(tensor) {
  const prediction = await models.yolo.predict(tensor)
  const boxes = await yolo.postprocess(prediction)
  prediction.dispose()
  return boxes
}

async function detectObjects(tensor) {
  const prediction = await models.objectDetection.predict(tensor)
  const objects = await mobilenet.classify(prediction)
  prediction.dispose()
  return objects
}

function dataURItoBlob(dataURI) {
  const byteString = atob(dataURI.split(",")[1])
  const mimeString = dataURI.split(",")[0].split(":")[1].split(";")[0]
  const ab = new ArrayBuffer(byteString.length)
  const ia = new Uint8Array(ab)
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i)
  }
  return new Blob([ab], { type: mimeString })
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyzeFrame") {
    analyzeFrame(request.frame).then((result) => {
      sendResponse(result)
    })
    return true // Indicates that the response is asynchronous
  }
})

