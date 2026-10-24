import { Capacitor, registerPlugin } from '@capacitor/core'

const NativeSmsGateway = registerPlugin('SmsGateway')

export const isNativeGateway = () => Capacitor.isNativePlatform()

export async function sendSms(to, message) {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('SIM SMS sending works only in the Android app')
  }
  return NativeSmsGateway.sendSms({ to, message })
}

export async function startSmsQueue(settings) {
  if (!Capacitor.isNativePlatform()) return
  return NativeSmsGateway.startQueue(settings)
}

export async function stopSmsQueue() {
  if (!Capacitor.isNativePlatform()) return
  return NativeSmsGateway.stopQueue()
}
