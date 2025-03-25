import Zemu from '@zondax/zemu'

const catchExit = async () => {
  process.on('SIGINT', () => {
    Zemu.stopAllEmuContainers(function () {
      process.exit()
    })
  })
}

// For Vitest, export setup and teardown hooks
export async function setup() {
  await catchExit()
  await Zemu.checkAndPullImage()
  await Zemu.stopAllEmuContainers()
}

// Original module.exports for compatibility
export default async () => {
  await catchExit()
  await Zemu.checkAndPullImage()
  await Zemu.stopAllEmuContainers()
}
