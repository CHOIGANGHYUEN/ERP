export class Rectangle {
  constructor(x, y, w, h) {
    this.x = x
    this.y = y
    this.w = w
    this.h = h
  }

  contains(entity) {
    return (
      entity.x >= this.x &&
      entity.x <= this.x + this.w &&
      entity.y >= this.y &&
      entity.y <= this.y + this.h
    )
  }

  intersects(range) {
    return !(
      range.x > this.x + this.w ||
      range.x + range.w < this.x ||
      range.y > this.y + this.h ||
      range.y + range.h < this.y
    )
  }
}

export class QuadTree {
  constructor(boundary, capacity = 10) {
    this.boundary = boundary
    this.capacity = capacity
    this.entities = []
    this.divided = false
  }

  insert(entity) {
    if (!this.boundary.contains(entity)) return false

    if (this.entities.length < this.capacity) {
      this.entities.push(entity)
      return true
    } else {
      if (!this.divided) this.subdivide()
      return (
        this.northeast.insert(entity) ||
        this.northwest.insert(entity) ||
        this.southeast.insert(entity) ||
        this.southwest.insert(entity)
      )
    }
  }

  subdivide() {
    const { x, y, w, h } = this.boundary
    const hw = w / 2
    const hh = h / 2
    this.northeast = new QuadTree(new Rectangle(x + hw, y, hw, hh), this.capacity)
    this.northwest = new QuadTree(new Rectangle(x, y, hw, hh), this.capacity)
    this.southeast = new QuadTree(new Rectangle(x + hw, y + hh, hw, hh), this.capacity)
    this.southwest = new QuadTree(new Rectangle(x, y + hh, hw, hh), this.capacity)
    this.divided = true
  }

  query(range, found = []) {
    if (!this.boundary.intersects(range)) return found

    for (let e of this.entities) {
      if (range.contains(e)) found.push(e)
    }

    if (this.divided) {
      this.northwest.query(range, found)
      this.northeast.query(range, found)
      this.southwest.query(range, found)
      this.southeast.query(range, found)
    }
    return found
  }
}
