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
    }

    /** 🚀 매 프레임 부드러운 보간 수행 */
    update(dt) {
        const lerpFactor = 0.15; // 0~1 사이의 부드러움 계수
        const zoomLerpFactor = 0.12;

        // 위치 보간 (Pos Lerp)
        this.x += (this.targetX - this.x) * lerpFactor;
        this.y += (this.targetY - this.y) * lerpFactor;

        // 줌 보간 (Zoom Lerp)
        this.zoom += (this.targetZoom - this.zoom) * zoomLerpFactor;

        // 📳 화면 흔들림 처리
        if (this.shakeIntensity > 0.1) {
            this.shakeX = (Math.random() - 0.5) * this.shakeIntensity;
            this.shakeY = (Math.random() - 0.5) * this.shakeIntensity;
            this.shakeIntensity *= 0.9; // 감쇄
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
        const factor = Math.pow(1.1, delta / 100);
        let newZoom = this.targetZoom * factor;

        // 0.1배 ~ 10.0배 제한
        newZoom = Math.max(0.1, Math.min(newZoom, 10.0));

        if (newZoom !== this.targetZoom) {
            const rect = e.target.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left) * (this.width / rect.width);
            const mouseY = (e.clientY - rect.top) * (this.height / rect.height);

            const worldX = mouseX / this.zoom + this.x;
            const worldY = mouseY / this.zoom + this.y;

            this.targetZoom = newZoom;
            
            // 줌 중심점 보정 (부드러운 타겟 이동)
            this.targetX = worldX - mouseX / newZoom;
            this.targetY = worldY - mouseY / newZoom;
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
            }
        }
        this.lastPinchDistance = distance;
    }

    resetPinch() {
        this.lastPinchDistance = null;
    }

    clamp() {
        const viewW = this.width / this.zoom;
        const viewH = this.height / this.zoom;
        
        // Target 좌표 기준으로 클램핑 (실제 좌표는 Lerp로 따라옴)
        if (this.mapWidth < viewW) {
            this.targetX = -(viewW - this.mapWidth) / 2;
        } else {
            this.targetX = Math.max(0, Math.min(this.targetX, this.mapWidth - viewW));
        }

        if (this.mapHeight < viewH) {
            this.targetY = -(viewH - this.mapHeight) / 2;
        } else {
            this.targetY = Math.max(0, Math.min(this.targetY, this.mapHeight - viewH));
        }
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
