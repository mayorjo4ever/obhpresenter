import { Presentation } from "./Presentation";

export interface PresentationQueueItem {

    /**
     * Queue Item ID
     */
    id: string;

    /**
     * Presentation to display
     */
    presentation: Presentation;

    /**
     * Position inside queue
     */
    order: number;

    /**
     * Optional label shown to operator
     */
    label?: string;

    /**
     * Whether this item has already been presented
     */
    completed: boolean;

    /**
     * Added timestamp
     */
    addedAt: string;

}

export interface PresentationQueue {

    /**
     * Queue items
     */
    items: PresentationQueueItem[];

    /**
     * Current presentation index
     */
    currentIndex: number;

}

 1 year  +  1  email = $44
 1 year  +  2  email = $62

 2 years + 1 email = $105
 2 years + 2 email = $152

 Charges = 8