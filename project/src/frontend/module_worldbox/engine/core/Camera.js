export default class Camera {
    constructor(canvasWidth, canvasHeight, mapWidth, mapHeight) {
        this.x = mapWidth / 2 - canvasWidth / 2;
        this.y = mapHeight / 2 - canvasHeight / 2;
        this.width = canvasWidth;
        this.height = canvasHeight;
        this.mapWidth = mapWidth;
        this.mapHeight = mapHeight;
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.zoom = 1.0;
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

        this.x -= dx;
        this.y -= dy;
        this.clamp();
    }

    handleMouseUp() {
        this.isDragging = false;
    }

    handleWheel(e) {
        const zoomSensitivity = 0.001;
        const delta = -e.deltaY;
        const factor = Math.pow(1.1, delta / 100);
        let newZoom = this.zoom * factor;

        // 0.1배 ~ 10.0배 제한 (Worldbox Spec)
        newZoom = Math.max(0.1, Math.min(newZoom, 10.0));

        if (newZoom !== this.zoom) {
            const rect = e.target.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left) * (this.width / rect.width);
            const mouseY = (e.clientY - rect.top) * (this.height / rect.height);

            const worldX = mouseX / this.zoom + this.x;
            const worldY = mouseY / this.zoom + this.y;

            this.zoom = newZoom;
            this.x = worldX - mouseX / this.zoom;
            this.y = worldY - mouseY / this.zoom;

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
            let newZoom = this.zoom * factor;
            newZoom = Math.max(0.1, Math.min(newZoom, 10.0));

            if (newZoom !== this.zoom) {
                const midX = (touch1.clientX + touch2.clientX) / 2;
                const midY = (touch1.clientY + touch2.clientY) / 2;

                const mouseX = (midX - rect.left) * (this.width / rect.width);
                const mouseY = (midY - rect.top) * (this.height / rect.height);

                const worldX = mouseX / this.zoom + this.x;
                const worldY = mouseY / this.zoom + this.y;

                this.zoom = newZoom;
                this.x = worldX - mouseX / this.zoom;
                this.y = worldY - mouseY / this.zoom;

                this.clamp();
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
        
        // 🚀 SMART CENTERING: If world is smaller than viewport, center it!
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
    }

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
