import { AudioVideoObserver, Logger, VideoSource, VideoTileControllerFacade, VideoTileState } from 'amazon-chime-sdk-js';
import RemoteVideoManager from './RemoteVideoManager';
import PaginationManager from './PaginationManager';
import { DemoVideoTile } from './VideoTile';
declare class TileOrganizer {
    static MaxTiles: number;
    tiles: {
        [id: number]: number;
    };
    tileStates: {
        [id: number]: boolean;
    };
    remoteTileCount: number;
    acquireTileIndex(tileId: number): number;
    releaseTileIndex(tileId: number): number;
}
export default class VideoTileCollection implements AudioVideoObserver {
    private videoTileController;
    private logger;
    private remoteVideoManager;
    private pageSize;
    private localAttendeeId;
    static readonly LocalVideoTileIndex: number;
    tileOrganizer: TileOrganizer;
    tileIndexToTileId: {
        [id: number]: number;
    };
    tileIdToTileIndex: {
        [id: number]: number;
    };
    tileIdToAttendeeId: {
        [id: number]: string;
    };
    tileIndexToPauseEventListener: {
        [id: number]: (event: Event) => void;
    };
    tileIndexToTargetResolutionEventListener: {
        [id: number]: (event: Event) => void;
    };
    tileIndexToPriorityEventListener: {
        [id: number]: (event: Event) => void;
    };
    tileIndexToDegradationPreferenceEventListener: {
        [id: number]: (event: Event) => void;
    };
    tileArea: HTMLDivElement;
    tileIndexToDemoVideoTile: Map<number, DemoVideoTile>;
    bandwidthConstrainedTiles: Set<number>;
    _activeSpeakerAttendeeId: string;
    set activeSpeakerAttendeeId(id: string);
    statsReportCount: number;
    statsReportInterval: number;
    pagination: PaginationManager<string>;
    constructor(videoTileController: VideoTileControllerFacade, logger: Logger, remoteVideoManager: RemoteVideoManager, pageSize: number, localAttendeeId: string);
    remoteVideoSourcesDidChange(videoSources: VideoSource[]): void;
    videoTileDidUpdate(tileState: VideoTileState): void;
    videoTileWasRemoved(tileId: number): void;
    private isLocalAttendee;
    showVideoWebRTCStats(videoMetricReport: {
        [id: string]: {
            [id: string]: {};
        };
    }): void;
    collectVideoWebRTCStats(videoMetricReport: {
        [id: string]: {
            [id: string]: {};
        };
    }): void;
    private setupVideoTiles;
    private tileIdForAttendeeId;
    private findContentTileId;
    private activeTileId;
    private layoutFeaturedTile;
    private updateLayout;
    private localTileId;
    private visibleTileIndices;
    private paginateLeft;
    private paginateRight;
    private updatePaginatedVisibleTiles;
    private createTargetResolutionListener;
    private createVideoPriorityListener;
    private createVideoDegradationPreferenceListener;
    private createPauseResumeListener;
}
export {};
