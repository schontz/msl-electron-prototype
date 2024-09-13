export default interface MediaEncoderObserver {
  audioSenderDidReceive(sender: RTCRtpSender): void;
  audioReceiverDidReceive(receiver: RTCRtpReceiver): void;
  videoSenderDidReceive(sender: RTCRtpSender): void;
  videoReceiverDidReceive(sender: RTCRtpReceiver): void;
}