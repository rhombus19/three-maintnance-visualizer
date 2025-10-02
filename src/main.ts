import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import Stats from 'three/addons/libs/stats.module.js'
import JEASINGS, { JEasing, Cubic } from 'jeasings'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'

interface Annotation {
    title: string
    description: string
    position: THREE.Vector3
    lookAt: THREE.Vector3
    camPos: THREE.Vector3
    descriptionDomElement?: HTMLElement
}

type Annotations = { [key: string]: Annotation }

let annotations: Annotations = {}
const annotationMarkers: THREE.Sprite[] = []
const annotationButtons = new Map<string, HTMLButtonElement>()
const sceneMeshes: THREE.Object3D[] = []

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x10131a)

const fog = new THREE.Fog(0x05070c, 35, 90)
scene.fog = fog

const ambientLight = new THREE.AmbientLight(0xffffff, 0.35)
scene.add(ambientLight)

const hemisphereLight = new THREE.HemisphereLight(0xcfe6ff, 0x11151c, 0.45)
scene.add(hemisphereLight)

const keyLight = new THREE.DirectionalLight(0xffffff, 1.2)
keyLight.position.set(-18, 26, 24)
keyLight.castShadow = true
keyLight.shadow.mapSize.set(2048, 2048)
keyLight.shadow.bias = -0.0005
const keyLightFrustum = 40
const keyLightCamera = keyLight.shadow.camera as THREE.OrthographicCamera
keyLightCamera.left = -keyLightFrustum
keyLightCamera.right = keyLightFrustum
keyLightCamera.top = keyLightFrustum
keyLightCamera.bottom = -keyLightFrustum
keyLightCamera.near = 10
keyLightCamera.far = 90
scene.add(keyLight)

const fillLight = new THREE.DirectionalLight(0x82a6ff, 0.6)
fillLight.position.set(24, 18, -16)
scene.add(fillLight)

const rimLight = new THREE.PointLight(0x4db8ff, 0.65)
rimLight.position.set(-6, 14, -18)
rimLight.distance = 60
scene.add(rimLight)

const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x1c2029, roughness: 0.94, metalness: 0.05 })
const ground = new THREE.Mesh(new THREE.CircleGeometry(22, 64), groundMaterial)
ground.rotation.x = -Math.PI / 2
ground.position.y = -0.02
ground.receiveShadow = true
scene.add(ground)
sceneMeshes.push(ground)

const platformAccentMaterial = new THREE.MeshBasicMaterial({
  color: 0x4db8ff,
  transparent: true,
  opacity: 0.18,
  side: THREE.DoubleSide,
})
const platformAccent = new THREE.Mesh(new THREE.RingGeometry(7.5, 9, 96), platformAccentMaterial)
platformAccent.rotation.x = -Math.PI / 2
platformAccent.position.y = 0.015
scene.add(platformAccent)
const platformElements: THREE.Object3D[] = [ground, platformAccent]

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
camera.position.x = 10
camera.position.y = 5
camera.position.z = 8

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.1
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setClearColor(scene.background)
document.body.appendChild(renderer.domElement)
renderer.domElement.style.display = 'block'
renderer.domElement.style.position = 'fixed'
renderer.domElement.style.top = '0'
renderer.domElement.style.left = '0'
renderer.domElement.style.width = '100%'
renderer.domElement.style.height = '100%'
renderer.domElement.style.zIndex = '0'

const labelRenderer = new CSS2DRenderer()
labelRenderer.setSize(window.innerWidth, window.innerHeight)
labelRenderer.domElement.style.position = 'absolute'
labelRenderer.domElement.style.top = '0px'
labelRenderer.domElement.style.pointerEvents = 'none'
labelRenderer.domElement.style.zIndex = '2'
document.body.appendChild(labelRenderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.dampingFactor = 0.2
controls.enableDamping = true
controls.target.set(8, 3, 4)
controls.enablePan = false
controls.minDistance = 4
controls.maxDistance = 28
controls.minPolarAngle = Math.PI / 4
controls.maxPolarAngle = Math.PI / 2
controls.rotateSpeed = 0.6

const raycaster = new THREE.Raycaster()

const circleTexture = new THREE.TextureLoader().load('/img/circle.png')

const progressBar = document.getElementById('progressBar') as HTMLProgressElement
const xRayToggleButton = document.getElementById('xRayToggle') as HTMLButtonElement | null
const platformToggleButton = document.getElementById('platformToggle') as HTMLButtonElement | null
const themeToggle = document.getElementById('themeToggle') as HTMLInputElement | null
const themeToggleLabel = document.getElementById('themeToggleLabel') as HTMLElement | null
const annotationHint = document.getElementById('annotationHint') as HTMLParagraphElement | null

const stats = new Stats()
document.body.appendChild(stats.dom)
stats.dom.style.left = 'auto'
stats.dom.style.top = 'auto'
stats.dom.style.right = '20px'
stats.dom.style.bottom = '20px'
stats.dom.style.pointerEvents = 'none'
stats.dom.style.borderRadius = '12px'

type ThemeKey = 'dark' | 'light'

const themeConfig: Record<ThemeKey, {
  background: number
  fog: { color: number; near: number; far: number }
  ambient: number
  key: number
  fill: number
  fillColor: number
  rim: { intensity: number; color: number }
  ground: number
  toneExposure: number
  markerColor: number
  platformAccentOpacity: number
  hemisphere: { sky: number; ground: number; intensity: number }
}> = {
  dark: {
    background: 0x10131a,
    fog: { color: 0x05070c, near: 35, far: 90 },
    ambient: 0.35,
    key: 1.2,
    fill: 0.6,
    fillColor: 0x82a6ff,
    rim: { intensity: 0.65, color: 0x4db8ff },
    ground: 0x1c2029,
    toneExposure: 1.1,
    markerColor: 0x4db8ff,
    platformAccentOpacity: 0.18,
    hemisphere: { sky: 0xcfe6ff, ground: 0x11151c, intensity: 0.55 },
  },
  light: {
    background: 0xdde2e9,
    fog: { color: 0xd1d6dd, near: 90, far: 180 },
    ambient: 0.6,
    key: 1.05,
    fill: 0.4,
    fillColor: 0xf3f6fa,
    rim: { intensity: 0.35, color: 0xa1c8ff },
    ground: 0xe2e6eb,
    toneExposure: 0.95,
    markerColor: 0x1e6bff,
    platformAccentOpacity: 0.12,
    hemisphere: { sky: 0xffffff, ground: 0xb7bec8, intensity: 0.7 },
  },
}

let activeTheme: ThemeKey = 'dark'
const platformPreferenceKey = 'maintenance-platform-visible'
let isPlatformVisible = true

function setPlatformVisibility(visible: boolean) {
  isPlatformVisible = visible
  platformElements.forEach((obj) => {
    obj.visible = visible
  })

  if (platformToggleButton) {
    platformToggleButton.textContent = visible ? 'Hide Platform' : 'Show Platform'
    platformToggleButton.setAttribute('aria-pressed', `${visible}`)
    platformToggleButton.classList.toggle('primary', !visible)
  }

  try {
    localStorage.setItem(platformPreferenceKey, visible ? 'true' : 'false')
  } catch (error) {
    console.warn('Unable to persist platform visibility preference', error)
  }
}

function applyTheme(theme: ThemeKey) {
  activeTheme = theme
  document.body.dataset.theme = theme

  const config = themeConfig[theme]
  ;(scene.background as THREE.Color).setHex(config.background)
  fog.color.setHex(config.fog.color)
  fog.near = config.fog.near
  fog.far = config.fog.far

  ambientLight.intensity = config.ambient
  keyLight.intensity = config.key
  fillLight.intensity = config.fill
  fillLight.color.setHex(config.fillColor)
  rimLight.intensity = config.rim.intensity
  rimLight.color.setHex(config.rim.color)
  hemisphereLight.intensity = config.hemisphere.intensity
  hemisphereLight.color.setHex(config.hemisphere.sky)
  hemisphereLight.groundColor.setHex(config.hemisphere.ground)
  groundMaterial.color.setHex(config.ground)
  platformAccentMaterial.color.setHex(config.markerColor)
  platformAccentMaterial.opacity = config.platformAccentOpacity
  platformAccentMaterial.needsUpdate = true

  renderer.toneMappingExposure = config.toneExposure
  renderer.setClearColor(scene.background as THREE.Color)

  annotationMarkers.forEach((marker) => {
    if (marker.material instanceof THREE.SpriteMaterial) {
      marker.material.color.setHex(config.markerColor)
      marker.material.needsUpdate = true
    }
  })

  stats.dom.style.backgroundColor = theme === 'light' ? 'rgba(236, 239, 243, 0.92)' : 'rgba(8, 11, 18, 0.78)'
  stats.dom.style.border = theme === 'light' ? '1px solid rgba(40, 47, 61, 0.12)' : '1px solid rgba(255, 255, 255, 0.08)'
  stats.dom.style.color = theme === 'light' ? '#1d242f' : '#f3f5fa'

  if (themeToggle) {
    themeToggle.checked = theme === 'light'
  }
  if (themeToggleLabel) {
    themeToggleLabel.textContent = theme === 'light' ? 'Light Mode' : 'Dark Mode'
  }

  try {
    localStorage.setItem('maintenance-theme', theme)
  } catch (error) {
    console.warn('Unable to persist theme preference', error)
  }
}

let storedTheme: ThemeKey | null = null
try {
  const value = localStorage.getItem('maintenance-theme') as ThemeKey | null
  if (value && value in themeConfig) {
    storedTheme = value
  }
} catch (error) {
  console.warn('Unable to read stored theme', error)
}

applyTheme(storedTheme ?? 'dark')

let storedPlatformVisibility: boolean | null = null
try {
  const value = localStorage.getItem(platformPreferenceKey)
  if (value === 'true' || value === 'false') {
    storedPlatformVisibility = value === 'true'
  }
} catch (error) {
  console.warn('Unable to read stored platform visibility preference', error)
}

setPlatformVisibility(storedPlatformVisibility ?? true)

if (platformToggleButton) {
  platformToggleButton.addEventListener('click', () => {
    setPlatformVisibility(!isPlatformVisible)
  })
}

if (themeToggle) {
  themeToggle.addEventListener('change', () => {
    applyTheme(themeToggle.checked ? 'light' : 'dark')
  })
}

let isXRayEnabled = false

async function loadAnnotations(url: string): Promise<Annotations> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`)
  return (await res.json()) as Annotations
}


const materialDefaults = new Map<THREE.Material, { depthTest: boolean; depthWrite: boolean; opacity: number; transparent: boolean }>();

function cacheMaterial(material: THREE.Material) {
  if (materialDefaults.has(material)) return;
  materialDefaults.set(material, {
    depthTest: material.depthTest,
    depthWrite: material.depthWrite ?? true,
    opacity: 'opacity' in material ? (material as THREE.Material & { opacity: number }).opacity : 1,
    transparent: material.transparent ?? false,
  });
}

function setXRayMode(enabled: boolean) {
  materialDefaults.forEach((defaults, material) => {
    cacheMaterial(material); // no-op if already cached
    material.depthTest = enabled ? false : defaults.depthTest;
    material.depthWrite = enabled ? false : defaults.depthWrite;
    if ('opacity' in material) {
      (material as THREE.Material & { opacity: number }).opacity = enabled ? 0.2 : defaults.opacity;
      material.transparent = enabled ? true : defaults.transparent;
    }
    material.needsUpdate = true;
  });
}

if (xRayToggleButton) {
  xRayToggleButton.addEventListener('click', () => {
    isXRayEnabled = !isXRayEnabled
    setXRayMode(isXRayEnabled)
    xRayToggleButton.textContent = isXRayEnabled ? 'Disable X-ray' : 'Enable X-ray'
    xRayToggleButton.setAttribute('aria-pressed', `${isXRayEnabled}`)
    xRayToggleButton.classList.toggle('primary', isXRayEnabled)
  })
}

const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('/js/libs/draco/')

const loader = new GLTFLoader()
loader.setDRACOLoader(dracoLoader)
loader.load(
    '/models/test_industrial.glb',
    async (gltf) => {
        gltf.scene.traverse((obj) => {
            if ((obj as THREE.Mesh).isMesh) {
                const mesh = obj as THREE.Mesh
                mesh.castShadow = true
                mesh.receiveShadow = true
            }

            if (!('material' in obj)) return;
            const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
            materials.forEach((mat) => {
                if (mat instanceof THREE.Material) cacheMaterial(mat);
                if (mat && 'envMapIntensity' in mat) {
                    (mat as THREE.MeshStandardMaterial).envMapIntensity = 1.15
                }
                if (mat && 'roughness' in mat && typeof (mat as { roughness?: number }).roughness === 'number') {
                    (mat as THREE.MeshStandardMaterial).roughness = Math.min((mat as THREE.MeshStandardMaterial).roughness ?? 0.9, 0.85)
                }
            });
        });

        scene.add(gltf.scene)
        sceneMeshes.push(gltf.scene)
        annotations = await loadAnnotations('/data/annotations.json')
        setXRayMode(isXRayEnabled)
        if (xRayToggleButton) {
            xRayToggleButton.disabled = false
            xRayToggleButton.textContent = isXRayEnabled ? 'Disable X-ray' : 'Enable X-ray'
            xRayToggleButton.setAttribute('aria-pressed', `${isXRayEnabled}`)
            xRayToggleButton.classList.toggle('primary', isXRayEnabled)
        }

        const annotationsPanel = document.getElementById('annotationsPanel') as HTMLDivElement | null
        if (annotationsPanel) {
            if (annotationHint) {
                annotationHint.style.display = 'none'
            }

            const existingList = annotationsPanel.querySelector('ul')
            if (existingList) {
                existingList.remove()
            }

            annotationButtons.clear()

            const ul = document.createElement('ul')
            annotationsPanel.appendChild(ul)

            Object.keys(annotations).forEach((annotationId) => {
                const annotation = annotations[annotationId]
                const li = document.createElement('li')
                ul.appendChild(li)

                const button = document.createElement('button')
                button.type = 'button'
                button.className = 'annotationButton'
                button.dataset.annotationId = annotationId

                const buttonTitle = document.createElement('span')
                buttonTitle.className = 'title'
                buttonTitle.textContent = annotation.title

                const buttonSubtitle = document.createElement('span')
                buttonSubtitle.className = 'subtitle'
                buttonSubtitle.textContent = `Component ${annotationId}`

                button.appendChild(buttonTitle)
                button.appendChild(buttonSubtitle)
                button.addEventListener('click', function () {
                    gotoAnnotation(annotation, annotationId)
                })

                li.appendChild(button)
                annotationButtons.set(annotationId, button)

                const annotationSpriteMaterial = new THREE.SpriteMaterial({
                    map: circleTexture,
                    color: new THREE.Color(themeConfig[activeTheme].markerColor),
                    depthTest: false,
                    depthWrite: false,
                    sizeAttenuation: false,
                })
                const annotationSprite = new THREE.Sprite(annotationSpriteMaterial)
                annotationSprite.scale.set(0.066, 0.066, 0.066)
                annotationSprite.position.copy(annotation.lookAt) // works with {x,y,z}
                annotationSprite.userData.id = annotationId
                annotationSprite.renderOrder = 1
                scene.add(annotationSprite)
                annotationMarkers.push(annotationSprite)

                const annotationDiv = document.createElement('div')
                annotationDiv.className = 'annotationLabel'
                annotationDiv.textContent = annotationId
                const annotationLabel = new CSS2DObject(annotationDiv)
                annotationLabel.position.copy(annotation.lookAt)
                scene.add(annotationLabel)

                if (annotation.description) {
                    const annotationDescriptionDiv = document.createElement('div')
                    annotationDescriptionDiv.className = 'annotationDescription'
                    annotationDescriptionDiv.innerHTML = annotation.description
                    annotationDiv.appendChild(annotationDescriptionDiv)
                    annotation.descriptionDomElement = annotationDescriptionDiv
                }
            })
        }

        progressBar.style.display = 'none'
        }, (xhr) => {
        if (xhr.lengthComputable) {
            progressBar.value = (xhr.loaded / xhr.total) * 100
            progressBar.style.display = 'block'
        }
        })

window.addEventListener('resize', onWindowResize, false)
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    labelRenderer.setSize(window.innerWidth, window.innerHeight)
    render()
}

const v = new THREE.Vector2()

function onClick(event: MouseEvent) {
    v.set(
        (event.clientX / renderer.domElement.clientWidth) * 2 - 1,
        -(event.clientY / renderer.domElement.clientHeight) * 2 + 1
    )
    raycaster.setFromCamera(v, camera)

    const intersects = raycaster.intersectObjects(annotationMarkers, true)
    if (intersects.length > 0) {
        const id = intersects[0].object.userData && intersects[0].object.userData.id
        if (typeof id === 'string' && annotations[id]) {
            gotoAnnotation(annotations[id], id)
        }
    }
}

renderer.domElement.addEventListener('click', onClick, false)

function onDoubleClick(event: MouseEvent) {
    v.set(
        (event.clientX / renderer.domElement.clientWidth) * 2 - 1,
        -(event.clientY / renderer.domElement.clientHeight) * 2 + 1
    )
    raycaster.setFromCamera(v, camera)

    const intersects = raycaster.intersectObjects(sceneMeshes, true)

    if (intersects.length > 0) {
        const p = intersects[0].point

        new JEasing(controls.target)
            .to(
                {
                    x: p.x,
                    y: p.y,
                    z: p.z,
                },
                500
            )
            .easing(Cubic.Out)
            .start()
    }
}
renderer.domElement.addEventListener('dblclick', onDoubleClick, false)

function gotoAnnotation(annotation: Annotation, annotationId?: string): void {
    new JEasing(camera.position)
        .to(
            {
                x: annotation.camPos.x,
                y: annotation.camPos.y,
                z: annotation.camPos.z,
            },
            500
        )
        .easing(Cubic.Out)
        .start()

    new JEasing(controls.target)
        .to(
            {
                x: annotation.lookAt.x,
                y: annotation.lookAt.y,
                z: annotation.lookAt.z,
            },
            500
        )
        .easing(Cubic.Out)
        .start()

    Object.keys(annotations).forEach((key) => {
        if (annotations[key].descriptionDomElement) {
            ;(annotations[key].descriptionDomElement as HTMLElement).style.display = 'none'
        }
    })
    if (annotation.descriptionDomElement) {
        annotation.descriptionDomElement.style.display = 'block'
    }

    annotationButtons.forEach((button, key) => {
        button.classList.toggle('active', key === annotationId)
    })
}

function animate() {
    requestAnimationFrame(animate)

    controls.update()

    JEASINGS.update()

    render()

    stats.update()
}

function render() {
    renderer.render(scene, camera)
    labelRenderer.render(scene, camera)
}

animate()
