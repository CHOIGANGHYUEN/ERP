/**
 * 🚀 MinHeap for A* Open List
 * Pathfinder.js에서 SRP에 따라 분리되었습니다.
 */
export default class MinHeap {
    constructor(compare) {
        this.nodes = [];
        this.compare = compare;
    }

    push(node) {
        this.nodes.push(node);
        this.bubbleUp(this.nodes.length - 1);
    }

    pop() {
        if (this.size() === 0) return null;
        if (this.size() === 1) return this.nodes.pop();
        const top = this.nodes[0];
        this.nodes[0] = this.nodes.pop();
        this.bubbleDown(0);
        return top;
    }

    size() {
        return this.nodes.length;
    }

    bubbleUp(index) {
        while (index > 0) {
            const parent = (index - 1) >> 1;
            if (this.compare(this.nodes[index], this.nodes[parent]) < 0) {
                [this.nodes[index], this.nodes[parent]] = [this.nodes[parent], this.nodes[index]];
                index = parent;
            } else break;
        }
    }

    bubbleDown(index) {
        const last = this.nodes.length - 1;
        while (true) {
            let left = (index << 1) + 1;
            let right = (index << 1) + 2;
            let smallest = index;
            if (left <= last && this.compare(this.nodes[left], this.nodes[smallest]) < 0) smallest = left;
            if (right <= last && this.compare(this.nodes[right], this.nodes[smallest]) < 0) smallest = right;
            if (smallest !== index) {
                [this.nodes[index], this.nodes[smallest]] = [this.nodes[smallest], this.nodes[index]];
                index = smallest;
            } else break;
        }
    }
}
