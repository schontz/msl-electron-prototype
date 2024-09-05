import { Logger, TargetDisplaySize, VideoQualityAdaptationPreference, VideoPriorityBasedPolicy, VideoSource, AllHighestVideoBandwidthPolicy } from 'amazon-chime-sdk-js';
export default class RemoteVideoManager {
    private logger;
    private downlinkPolicy;
    static readonly DefaultVideoTilePriority: number;
    static readonly DefaultVideoTileTargetDisplaySize: TargetDisplaySize;
    private attendeeIdToVideoPreference;
    _visibleAttendees: string[];
    set visibleAttendees(value: Array<string>);
    constructor(logger: Logger, downlinkPolicy: VideoPriorityBasedPolicy | AllHighestVideoBandwidthPolicy);
    ensureDefaultPreferences(videoSources: VideoSource[]): void;
    setAttendeeTargetDisplaySize(attendeeId: string, targetDisplaySize: TargetDisplaySize): void;
    setAttendeePriority(attendeeId: string, priority: number): void;
    setAttendeeDegradationPreference(attendeeId: string, preference: VideoQualityAdaptationPreference): void;
    supportsRemoteVideoPreferences(): boolean;
    private updateDownlinkPreference;
}
