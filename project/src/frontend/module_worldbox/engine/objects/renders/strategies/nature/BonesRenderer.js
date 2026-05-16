/**
 * 🦴 BonesRenderer
 * 뼈 무더기 자원의 구체적인 그리기 로직을 담당합니다.
 */
export class BonesRenderer {
    static draw(ctx, t, v) {
        ctx.fillStyle = '#eeeeee';
        ctx.fillRect(-2, -1, 4, 2);
    }
}
