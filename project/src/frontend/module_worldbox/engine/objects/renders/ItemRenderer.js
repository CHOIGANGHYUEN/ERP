/**
 * 📦 ItemRenderer
 * 바닥에 드랍된 아이템 엔티티의 시각적 표현을 담당합니다.
 * [Expert Design] 그라데이션, 글로우, 입체 명암을 적용하여 'Wowed' 디자인 구현
 */
export const ItemRenderer = {
    render(ctx, itemType, v, time, entity) {
        const s = v.size || 8;
        const animTime = time * 0.005;
        
        ctx.save();
        
        // 🌀 [Premium Animation] 부드러운 부유 및 미세한 스케일링
        const floatY = Math.sin(animTime * 2.0) * 2.5;
        const pulse = 1.0 + Math.sin(animTime * 3.0) * 0.05;
        const rotate = Math.sin(animTime * 0.8) * 0.1;
        
        ctx.translate(0, floatY);
        ctx.rotate(rotate);
        ctx.scale(pulse, pulse);

        // ✨ [Glow Effect] 아이템 하단 은은한 오라
        ctx.save();
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.5);
        glow.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
        glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, s * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 🤕 [Hit Shake]
        const health = entity?.components?.get('Health');
        if (health && health.hitTimer > 0) {
            ctx.translate(Math.sin(time * 0.1) * 2, 0);
        }

        switch (itemType) {
            case 'wood': this.drawWood(ctx, s); break;
            case 'meat': this.drawMeat(ctx, s); break;
            case 'fruit': this.drawFruit(ctx, s, time); break;
            case 'stone': this.drawStone(ctx, s); break;
            case 'iron_ore': this.drawIron(ctx, s); break;
            case 'coal': this.drawCoal(ctx, s); break;
            case 'gold': this.drawGold(ctx, s, time); break;
            case 'grass': this.drawGrass(ctx, s); break;
            case 'flower': this.drawFlower(ctx, s); break;
            case 'milk': this.drawMilk(ctx, s); break;
            case 'poop': this.drawPoop(ctx, s); break;
            case 'kelp': this.drawKelp(ctx, s); break;
            default: this.drawDefaultItem(ctx, s, itemType);
        }

        ctx.restore();
        
        // 🏷️ [User Request] 아이템 정보 표시 (이름 및 수량)
        this.renderInfoLabel(ctx, itemType, v, entity);
    },

    renderInfoLabel(ctx, itemType, v, entity) {
        const drop = entity?.components?.get('DroppedItem');
        if (!drop) return;

        ctx.save();
        const amount = drop.amount || 1;
        const displayName = itemType.replace('_', ' ').toUpperCase();
        
        // 아주 작게 표시하여 아기자기함 유지
        ctx.translate(0, -v.size * 1.5 - 2);
        ctx.font = 'bold 7px Inter, Arial';
        ctx.textAlign = 'center';
        
        // 배경 박스 (은은하게)
        const text = `${displayName} x${amount}`;
        const textWidth = ctx.measureText(text).width;
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.roundRect(-textWidth/2 - 2, -6, textWidth + 4, 8, 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, 0, 0);
        ctx.restore();
    },

    /** 🪵 목재 (Wood Log) - 입체적인 통나무 질감 */
    drawWood(ctx, s) {
        // 본체
        const grad = ctx.createLinearGradient(-s*0.6, 0, s*0.6, 0);
        grad.addColorStop(0, '#3e2723');
        grad.addColorStop(0.5, '#5d4037');
        grad.addColorStop(1, '#3e2723');
        
        ctx.fillStyle = grad;
        ctx.fillRect(-s*0.7, -s*0.25, s*1.4, s*0.5);
        
        // 상단 하이라이트
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(-s*0.7, -s*0.25, s*1.4, s*0.1);
        
        // 나이테 단면
        ctx.fillStyle = '#d7ccc8';
        ctx.beginPath();
        ctx.ellipse(s*0.6, 0, s*0.15, s*0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#8d6e63';
        ctx.lineWidth = 0.5;
        ctx.stroke();
    },

    /** 🍖 고기 (Meat) - 신선한 마블링 느낌 */
    drawMeat(ctx, s) {
        const grad = ctx.createRadialGradient(-s*0.2, -s*0.2, 0, 0, 0, s*0.8);
        grad.addColorStop(0, '#ff5252');
        grad.addColorStop(1, '#b71c1c');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(0, 0, s*0.7, s*0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 마블링 (지방층)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(-s*0.3, -s*0.1);
        ctx.quadraticCurveTo(0, s*0.2, s*0.4, -s*0.1);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // 뼈
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(-s*0.9, -s*0.15, s*0.4, s*0.3);
        ctx.beginPath();
        ctx.arc(-s*0.9, -s*0.1, s*0.15, 0, Math.PI*2);
        ctx.arc(-s*0.9, s*0.1, s*0.15, 0, Math.PI*2);
        ctx.fill();
    },

    /** 🍎 열매 (Fruit) */
    drawFruit(ctx, s, time) {
        const grad = ctx.createRadialGradient(-s*0.1, -s*0.1, s*0.05, 0, 0, s*0.5);
        grad.addColorStop(0, '#ff4081');
        grad.addColorStop(1, '#c2185b');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, s*0.45, 0, Math.PI * 2);
        ctx.fill();
        
        // 하이라이트 반사광
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.arc(-s*0.15, -s*0.15, s*0.1, 0, Math.PI*2);
        ctx.fill();
        
        // 꼭지
        ctx.fillStyle = '#4caf50';
        ctx.fillRect(-1, -s*0.6, 2, s*0.3);
    },

    /** 🪨 석재 (Stone) - 거친 암석 질감 */
    drawStone(ctx, s) {
        const grad = ctx.createLinearGradient(-s*0.5, -s*0.5, s*0.5, s*0.5);
        grad.addColorStop(0, '#bdbdbd');
        grad.addColorStop(1, '#616161');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(-s*0.5, s*0.3);
        ctx.lineTo(s*0.4, s*0.4);
        ctx.lineTo(s*0.6, -s*0.2);
        ctx.lineTo(s*0.2, -s*0.5);
        ctx.lineTo(-s*0.4, -s*0.4);
        ctx.closePath();
        ctx.fill();
        
        // 균열 디테일
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.moveTo(0, -s*0.2);
        ctx.lineTo(s*0.2, s*0.1);
        ctx.stroke();
    },

    /** 💰 금 (Gold) - 화려한 광택과 반짝임 */
    drawGold(ctx, s, time) {
        const grad = ctx.createLinearGradient(-s*0.5, -s*0.5, s*0.5, s*0.5);
        grad.addColorStop(0, '#fff176');
        grad.addColorStop(0.5, '#fbc02d');
        grad.addColorStop(1, '#f57f17');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(-s*0.6, s*0.2);
        ctx.lineTo(s*0.6, s*0.2);
        ctx.lineTo(s*0.4, -s*0.4);
        ctx.lineTo(-s*0.4, -s*0.4);
        ctx.closePath();
        ctx.fill();
        
        // 황금 광택선
        const shininess = (Math.sin(time * 0.01) + 1) * 0.5;
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 + shininess * 0.5})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-s*0.3, -s*0.3);
        ctx.lineTo(s*0.3, s*0.1);
        ctx.stroke();

        // ✨ 반짝임 파티클 (애니메이션)
        if (shininess > 0.8) {
            ctx.fillStyle = '#fff';
            const sparkSize = 2;
            ctx.fillRect(s*0.4, -s*0.5, sparkSize, sparkSize);
            ctx.fillRect(-s*0.5, -s*0.1, sparkSize, sparkSize);
        }
    },

    /** 🌿 풀뭉치 (Grass Bundle) */
    drawGrass(ctx, s) {
        ctx.fillStyle = '#43a047';
        for(let i=0; i<3; i++) {
            ctx.save();
            ctx.rotate((i - 1) * 0.4);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(-s*0.3, -s*0.5, 0, -s*0.9);
            ctx.quadraticCurveTo(s*0.3, -s*0.5, 0, 0);
            ctx.fill();
            ctx.restore();
        }
        // 묶음 끈
        ctx.fillStyle = '#8d6e63';
        ctx.fillRect(-s*0.4, -s*0.2, s*0.8, 1.5);
    },

    /** 🌻 꽃 (Dropped Flower) */
    drawFlower(ctx, s) {
        // 꽃잎
        ctx.fillStyle = '#ffeb3b';
        for(let i=0; i<6; i++) {
            const angle = (i/6) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(Math.cos(angle)*s*0.35, Math.sin(angle)*s*0.35, s*0.25, 0, Math.PI*2);
            ctx.fill();
        }
        // 중앙
        const centerGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, s*0.2);
        centerGrad.addColorStop(0, '#f44336');
        centerGrad.addColorStop(1, '#d32f2f');
        ctx.fillStyle = centerGrad;
        ctx.beginPath();
        ctx.arc(0, 0, s*0.2, 0, Math.PI*2);
        ctx.fill();
    },

    /** 🥛 우유 (Milk Bottle) */
    drawMilk(ctx, s) {
        // 병 본체 (유리 느낌)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(-s*0.35, -s*0.4, s*0.7, s*0.8);
        
        // 우유 내용물
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-s*0.3, -s*0.1, s*0.6, s*0.45);
        
        // 뚜껑/라벨
        ctx.fillStyle = '#2196f3';
        ctx.fillRect(-s*0.35, -s*0.5, s*0.7, s*0.15);
        ctx.fillRect(-s*0.35, -s*0.1, s*0.7, s*0.1);
    },

    /** 💩 똥 (Dropped Poop) */
    drawPoop(ctx, s) {
        const grad = ctx.createLinearGradient(0, -s*0.6, 0, s*0.2);
        grad.addColorStop(0, '#795548');
        grad.addColorStop(1, '#3e2723');
        
        ctx.fillStyle = grad;
        // 3단 구조 (더 곡선화)
        this.fillCircle(ctx, 0, s*0.1, s*0.45);
        this.fillCircle(ctx, 0, -s*0.2, s*0.35);
        this.fillCircle(ctx, 0, -s*0.45, s*0.2);
    },

    fillCircle(ctx, x, y, r) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI*2);
        ctx.fill();
    },

    /** 🌿 해초 (Dropped Kelp) */
    drawKelp(ctx, s) {
        const grad = ctx.createLinearGradient(0, -s*0.8, 0, 0);
        grad.addColorStop(0, '#4caf50');
        grad.addColorStop(1, '#1b5e20');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-s*0.6, -s*0.2, -s*0.6, -s*0.6, 0, -s*1.0);
        ctx.bezierCurveTo(s*0.6, -s*0.6, s*0.6, -s*0.2, 0, 0);
        ctx.fill();
        
        // 하이라이트
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.moveTo(-2, -s*0.2);
        ctx.lineTo(-2, -s*0.7);
        ctx.stroke();
    },

    /** ⛓️ 철광석 (Iron Ore) - 금속 광택과 어두운 회색 질감 */
    drawIron(ctx, s) {
        const grad = ctx.createLinearGradient(-s*0.5, -s*0.5, s*0.5, s*0.5);
        grad.addColorStop(0, '#78909c');
        grad.addColorStop(0.5, '#455a64');
        grad.addColorStop(1, '#263238');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(-s*0.5, s*0.2);
        ctx.lineTo(s*0.4, s*0.4);
        ctx.lineTo(s*0.6, -s*0.2);
        ctx.lineTo(s*0.1, -s*0.5);
        ctx.closePath();
        ctx.fill();

        // 금속 광택
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-s*0.2, -s*0.2);
        ctx.lineTo(s*0.2, s*0.1);
        ctx.stroke();
    },

    /** ⬛ 석탄 (Coal) - 거칠고 어두운 질감 */
    drawCoal(ctx, s) {
        ctx.fillStyle = '#212121';
        ctx.beginPath();
        ctx.moveTo(-s*0.4, s*0.4);
        ctx.lineTo(s*0.5, s*0.3);
        ctx.lineTo(s*0.4, -s*0.4);
        ctx.lineTo(-s*0.5, -s*0.3);
        ctx.closePath();
        ctx.fill();

        // 거친 단면 표현
        ctx.strokeStyle = '#424242';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(-s*0.2, -s*0.1);
        ctx.lineTo(s*0.1, s*0.2);
        ctx.stroke();
    },

    drawDefaultItem(ctx, s, type) {
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.roundRect(-s*0.6, -s*0.6, s*1.2, s*1.2, 2);
        ctx.fill();
        ctx.fillStyle = '#333';
        ctx.font = `bold ${s}px Inter, Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('📦', 0, 0);
    }
};
