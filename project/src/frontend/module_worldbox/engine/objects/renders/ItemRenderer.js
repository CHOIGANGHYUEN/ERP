/**
 * 📦 ItemRenderer
 * 바닥에 드랍된 아이템 엔티티의 시각적 표현을 담당합니다.
 * [Expert Design] 그라데이션, 글로우, 입체 명암을 적용하여 'Wowed' 디자인 구현
 */
export const ItemRenderer = {
    render(ctx, itemType, v, time, entity, engine) {
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

        const lower = itemType.toLowerCase();
        
        // 🎯 [Priority Fix] 특수 아이템 및 식물 계열을 먼저 판정하여 'wood' 오판 방지
        if (lower.includes('grass') || lower.includes('pasture') || lower.includes('plant') || lower.includes('leaf') || lower.includes('shrub') || lower.includes('bush') || lower.includes('reed') || lower.includes('vine') || lower.includes('moss') || lower.includes('fiber')) this.drawGrass(ctx, s);
        else if (lower.includes('flower')) this.drawFlower(ctx, s);
        else if (lower.includes('mushroom')) this.drawMushroom(ctx, s);
        else if (lower.includes('meat')) this.drawMeat(ctx, s);
        else if (lower.includes('fruit') || lower.includes('berry') || lower.includes('apple')) this.drawFruit(ctx, s, time);
        else if (lower.includes('iron')) this.drawIron(ctx, s);
        else if (lower.includes('gold')) this.drawGold(ctx, s, time);
        else if (lower.includes('coal')) this.drawCoal(ctx, s);
        else if (lower.includes('stone') || lower.includes('rock') || lower.includes('mineral')) this.drawStone(ctx, s);
        else if (lower.includes('milk')) this.drawMilk(ctx, s);
        else if (lower.includes('poop')) this.drawPoop(ctx, s);
        else if (lower.includes('kelp') || lower.includes('seaweed')) this.drawKelp(ctx, s);
        // 나무는 다른 모든 특정 타입이 아닐 때만 가장 마지막에 판정
        else if (lower.includes('wood') || lower.includes('tree') || lower.includes('log')) this.drawWood(ctx, s);
        else this.drawDefaultItem(ctx, s, itemType);

        ctx.restore();
        
        // 🏷️ [Connection Fix] resource_balance.json 데이터와 직접 연결
        this.renderInfoLabel(ctx, itemType, v, entity, engine);
    },

    renderInfoLabel(ctx, itemType, v, entity, engine) {
        const drop = entity?.components?.get('DroppedItem');
        if (!drop) return;

        ctx.save();
        const amount = drop.amount || 1;
        
        // 🏷️ [High Cohesion] 아이템 컴포넌트가 이미 알고 있는 이름을 즉시 사용
        const realName = drop.displayName || itemType;
        
        // 아주 작게 표시하여 아기자기함 유지
        ctx.translate(0, -v.size * 1.5 - 2);
        ctx.font = 'bold 6px Inter, Arial';
        ctx.textAlign = 'center';
        
        // 배경 박스 (은은하게)
        const text = `${realName} x${amount}`;
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
    
    /** 🍄 버섯 (Dropped Mushroom) */
    drawMushroom(ctx, s) {
        // 기둥
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(-s*0.15, 0, s*0.3, s*0.5);
        
        // 갓
        const grad = ctx.createRadialGradient(0, -s*0.2, 0, 0, -s*0.2, s*0.6);
        grad.addColorStop(0, '#ff5252');
        grad.addColorStop(1, '#d32f2f');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(0, -s*0.1, s*0.6, s*0.4, 0, Math.PI, 0);
        ctx.fill();
        
        // 점박이
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        this.fillCircle(ctx, -s*0.2, -s*0.3, s*0.1);
        this.fillCircle(ctx, s*0.2, -s*0.2, s*0.08);
        this.fillCircle(ctx, 0, -s*0.4, s*0.12);
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
