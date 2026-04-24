export class BlacklistService {
  constructor() {
    this.blacklist = new Map() // id -> expiration timestamp
  }

  /**
   * 블랙리스트 등록
   * @param {string|number} targetId 
   * @param {number} durationMs 기본 30초 동안 블랙리스트 유지
   */
  add(targetId, durationMs = 30000) {
    this.blacklist.set(targetId, Date.now() + durationMs)
  }

  /**
   * 블랙리스트 여부 확인
   * @param {string|number} targetId 
   * @returns {boolean}
   */
  isBlacklisted(targetId) {
    const expiration = this.blacklist.get(targetId)
    if (!expiration) return false

    if (Date.now() > expiration) {
      this.blacklist.delete(targetId)
      return false
    }
    return true
  }

  /**
   * 만료된 항목 정리 (주기적으로 호출 권장)
   */
  cleanup() {
    const now = Date.now()
    for (const [id, expiration] of this.blacklist.entries()) {
      if (now > expiration) {
        this.blacklist.delete(id)
      }
    }
  }
}
