export default class Camera {
    constructor(canvasWidth, canvasHeight, mapWidth, mapHeight) {
        this.x = mapWidth / 2 - canvasWidth / 2;
        this.y = mapHeight / 2 - canvasHeight / 2;
        this.targetX = this.x;
        this.targetY = this.y;
        
        this.width = canvasWidth;
        this.height = canvasHeight;
        this.mapWidth = mapWidth;
        this.mapHeight = mapHeight;
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        
        this.zoom = 1.0;
        this.targetZoom = 1.0;

        // 📳 Shake Effect
        this.shakeIntensity = 0;
        this.shakeX = 0;
        this.shakeY = 0;

        // ⚓ Zoom Anchor Memory
        this.lastAnchorWorldX = this.x;
        this.lastAnchorWorldY = this.y;
        this.lastAnchorMouseX = 0;
        this.lastAnchorMouseY = 0;
    }

    /** 🚀 매 프레임 부드러운 보간 수행 */
    update(dt) {
        const lerpFactor = 0.12; 

        // 🛡️ [Stability] NaN 및 Zero 방지
        if (isNaN(this.targetZoom) || this.targetZoom <= 0.05) this.targetZoom = 1.0;

        // 1. 줌 보간 (Zoom Lerp)을 먼저 수행
        const dz = (this.targetZoom - this.zoom);
        if (Math.abs(dz) > 0.0001) {
            this.zoom += dz * lerpFactor;
        } else {
            this.zoom = this.targetZoom;
        }
        
        if (isNaN(this.zoom) || this.zoom <= 0.05) this.zoom = 1.0;

        // 2. 🎯 [Expert Fix] 부드러운 위치 보간 (Panning & Zoom Follow)
        // 앵커 포인트를 기준으로 보간하여 튕김과 미끄러짐을 방지합니다.
        const targetAnchorX = this.targetX + this.lastAnchorMouseX / this.targetZoom;
        const targetAnchorY = this.targetY + this.lastAnchorMouseY / this.targetZoom;

        const adx = (targetAnchorX - this.lastAnchorWorldX);
        const ady = (targetAnchorY - this.lastAnchorWorldY);
        
        if (Math.abs(adx) > 0.01) this.lastAnchorWorldX += adx * lerpFactor;
        else this.lastAnchorWorldX = targetAnchorX;

        if (Math.abs(ady) > 0.01) this.lastAnchorWorldY += ady * lerpFactor;
        else this.lastAnchorWorldY = targetAnchorY;

        // 보간된 앵커와 현재 줌을 바탕으로 위치 역산 (Anchor Lock)
        this.x = this.lastAnchorWorldX - this.lastAnchorMouseX / this.zoom;
        this.y = this.lastAnchorWorldY - this.lastAnchorMouseY / this.zoom;

        // 📳 화면 흔들림 처리
        if (this.shakeIntensity > 0.1) {
            this.shakeX = (Math.random() - 0.5) * this.shakeIntensity;
            this.shakeY = (Math.random() - 0.5) * this.shakeIntensity;
            this.shakeIntensity *= 0.9;
        } else {
            this.shakeX = 0;
            this.shakeY = 0;
            this.shakeIntensity = 0;
        }

        this.clamp();
    }

    shake(intensity = 5) {
        this.shakeIntensity = intensity;
    }

    handleMouseDown(e) {
        this.isDragging = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
    }

    handleMouseMove(e) {
        if (!this.isDragging) return;

        const rect = e.target.getBoundingClientRect();
        const scaleX = this.width / rect.width;
        const scaleY = this.height / rect.height;

        const dx = ((e.clientX - this.lastMouseX) * scaleX) / this.zoom;
        const dy = ((e.clientY - this.lastMouseY) * scaleY) / this.zoom;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;

        // 즉시 이동 대신 타겟 설정
        this.targetX -= dx;
        this.targetY -= dy;
    }

    handleMouseUp() {
        this.isDragging = false;
    }

    handleWheel(e) {
        const delta = -e.deltaY;
        const factor = Math.pow(1.15, delta / 120); 
        const oldTargetZoom = this.targetZoom;
        let newZoom = oldTargetZoom * factor;

        // 0.1배 ~ 10.0배 제한 (거인 방지)
        newZoom = Math.max(0.1, Math.min(newZoom, 10.0));
        if (isNaN(newZoom)) newZoom = oldTargetZoom;

        if (newZoom !== oldTargetZoom) {
            const rect = e.target.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left) * (this.width / rect.width);
            const mouseY = (e.clientY - rect.top) * (this.height / rect.height);

            // 🎯 [Expert Fix] 마우스 아래의 '진짜 목표 월드 좌표'를 계산
            // 현재 보간 중인 x가 아니라, 이미 가기로 했던 targetX를 기준으로 계산해야 밀리지 않습니다.
            const worldX = mouseX / oldTargetZoom + this.targetX;
            const worldY = mouseY / oldTargetZoom + this.targetY;

            this.targetZoom = newZoom;
            
            // ⚓ [Expert Anchor] 휠 이벤트 시점의 앵커 정보 저장
            this.lastAnchorWorldX = worldX;
            this.lastAnchorWorldY = worldY;
            this.lastAnchorMouseX = mouseX;
            this.lastAnchorMouseY = mouseY;

            // 🎯 새로운 줌에서도 worldX가 mouseX 위치에 오도록 targetX 역산
            this.targetX = worldX - mouseX / newZoom;
            this.targetY = worldY - mouseY / newZoom;

            // 즉시 클램핑하여 오차 전파 방지
            this.clamp();
        }
    }

    // 📱 Pinch Zoom support for Mobile
    handlePinch(touch1, touch2, rect) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (this.lastPinchDistance) {
            const factor = distance / this.lastPinchDistance;
            let newZoom = this.targetZoom * factor;
            newZoom = Math.max(0.1, Math.min(newZoom, 10.0));

            if (newZoom !== this.targetZoom) {
                const midX = (touch1.clientX + touch2.clientX) / 2;
                const midY = (touch1.clientY + touch2.clientY) / 2;

                const mouseX = (midX - rect.left) * (this.width / rect.width);
                const mouseY = (midY - rect.top) * (this.height / rect.height);

                const worldX = mouseX / this.zoom + this.x;
                const worldY = mouseY / this.zoom + this.y;

                this.targetZoom = newZoom;
                this.targetX = worldX - mouseX / newZoom;
                this.targetY = worldY - mouseY / newZoom;

                // ⚓ 앵커 정보 업데이트
                this.lastAnchorWorldX = worldX;
                this.lastAnchorWorldY = worldY;
                this.lastAnchorMouseX = mouseX;
                this.lastAnchorMouseY = mouseY;
            }
        }
        this.lastPinchDistance = distance;
    }

    resetPinch() {
        this.lastPinchDistance = null;
    }

    clamp() {
        // 🎯 [Expert Fix] 보간 중인 zoom이 아닌 targetZoom을 기준으로 가시 영역 계산
        const viewW = this.width / this.zoom;
        const viewH = this.height / this.zoom;
        const targetViewW = this.width / this.targetZoom;
        const targetViewH = this.height / this.targetZoom;
        
        // 1. Target 좌표 클램핑
        if (this.mapWidth < targetViewW) {
            this.targetX = -(targetViewW - this.mapWidth) / 2;
        } else {
            this.targetX = Math.max(0, Math.min(this.targetX, this.mapWidth - targetViewW));
        }

        if (this.mapHeight < targetViewH) {
            this.targetY = -(targetViewH - this.mapHeight) / 2;
        } else {
            this.targetY = Math.max(0, Math.min(this.targetY, this.mapHeight - targetViewH));
        }

        // 2. 현재 좌표(this.x, this.y) 클램핑
        if (this.mapWidth < viewW) {
            this.x = -(viewW - this.mapWidth) / 2;
        } else {
            this.x = Math.max(0, Math.min(this.x, this.mapWidth - viewW));
        }

        if (this.mapHeight < viewH) {
            this.y = -(viewH - this.mapHeight) / 2;
        } else {
            this.y = Math.max(0, Math.min(this.y, this.mapHeight - viewH));
        }

        // 3. ⚓ [Expert] 클램핑된 위치에 맞춰 앵커 동기화 (튕김 현상 방지 핵심)
        this.lastAnchorWorldX = this.x + this.lastAnchorMouseX / this.zoom;
        this.lastAnchorWorldY = this.y + this.lastAnchorMouseY / this.zoom;
    }

    // 🎥 실제 렌더링 시 사용할 x, y (흔들림 적용됨)
    get renderX() { return this.x + this.shakeX; }
    get renderY() { return this.y + this.shakeY; }

    // Helper: Screen to World
    screenToWorld(sx, sy, rect) {
        const mx = (sx - rect.left) * (this.width / rect.width);
        const my = (sy - rect.top) * (this.height / rect.height);
        return {
            x: mx / this.zoom + this.x,
            y: my / this.zoom + this.y
        };
    }

    /** 👁️ 가시 영역(AABB) 계산 */
    getViewportBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width / this.zoom,
            height: this.height / this.zoom
        };
    }
}
