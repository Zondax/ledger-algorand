export type BIP32Path = string

const HARDENED = 0x80000000

export function serializePath(path: BIP32Path, requiredPathLengths?: number[]): Buffer {
  if (typeof path !== 'string') {
    // NOTE: this is probably unnecessary
    throw new Error("Path should be a string (e.g \"m/44'/461'/5'/0/3\")")
  }

  if (!path.startsWith('m/')) {
    throw new Error('Path should start with "m/" (e.g "m/44\'/461\'/5\'/0/3")')
  }

  const pathArray = path.split('/')
  pathArray.shift() // remove "m"

  if (requiredPathLengths && requiredPathLengths.length > 0 && !requiredPathLengths.includes(pathArray.length)) {
    throw new Error("Invalid path length. (e.g \"m/44'/5757'/5'/0/3\")")
  }

  const buf = Buffer.alloc(4 * pathArray.length)
  pathArray.forEach((child: string, i: number) => {
    let value = 0

    if (child.endsWith("'")) {
      value += HARDENED
      child = child.slice(0, -1)
    }

    const numChild = Number(child)

    if (Number.isNaN(numChild)) {
      throw new Error(`Invalid path : ${child} is not a number. (e.g "m/44'/461'/5'/0/3")`)
    }

    if (numChild >= HARDENED) {
      throw new Error('Incorrect child value (bigger or equal to 0x80000000)')
    }

    value += numChild
    buf.writeUInt32LE(value, 4 * i)
  })

  return buf
}