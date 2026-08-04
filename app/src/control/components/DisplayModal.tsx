import { useEffect, useState } from "react";
import { DisplayInfo, WirelessStatus } from "../../shared/types";

interface Props {
  onClose: () => void;
}

const EMPTY_WIRELESS: WirelessStatus = { running: false, url: null, qrDataUrl: null };

export default function DisplayModal({ onClose }: Props) {
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [wireless, setWireless] = useState<WirelessStatus>(EMPTY_WIRELESS);
  const [wirelessBusy, setWirelessBusy] = useState(false);

  useEffect(() => {
    window.obh?.listDisplays().then((d) => setDisplays(d ?? []));
    window.obh?.getWirelessStatus().then((s) => setWireless(s ?? EMPTY_WIRELESS));
    const unsubscribe = window.obh?.onDisplaysChanged((d) => setDisplays(d));
    return () => unsubscribe?.();
  }, []);

  async function refreshDisplays() {
    const d = await window.obh?.listDisplays();
    if (d) setDisplays(d);
  }

  async function useDisplay(id: number) {
    const d = await window.obh?.useDisplay(id);
    if (d) setDisplays(d);
  }

  async function toggleWireless() {
    setWirelessBusy(true);
    const status = wireless.running
      ? await window.obh?.stopWirelessDisplay()
      : await window.obh?.startWirelessDisplay();
    if (status) setWireless(status);
    setWirelessBusy(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h3>Displays &amp; Wireless</h3>
        <p className="modal-hint">
          A wireless HDMI/Miracast dongle plugged into your TV shows up below
          exactly like a wired monitor — pick it as the projector target.
        </p>

        <div className="display-list">
          {displays.map((d) => (
            <div key={d.id} className={d.isSelected ? "display-row active" : "display-row"}>
              <div>
                <div className="display-row-label">
                  {d.label}
                  {d.isPrimary && <span className="display-row-tag">Primary</span>}
                </div>
                <div className="display-row-size">
                  {d.width} × {d.height}
                </div>
              </div>
              <button className="btn" onClick={() => useDisplay(d.id)} disabled={d.isSelected}>
                {d.isSelected ? "In use" : "Use as Projector"}
              </button>
            </div>
          ))}
          {displays.length === 0 && <p className="modal-hint">No displays detected.</p>}
        </div>
        <button className="btn" onClick={refreshDisplays}>
          Refresh
        </button>

        <div className="modal-divider-full" />

        <h3 className="modal-subheading">Network Projection (no dongle)</h3>
        <p className="modal-hint">
          Starts a link on your WiFi network — open it in any TV or phone
          browser to show the live feed there. Anyone on the same WiFi can
          view it while this is running, so switch it off when you're done.
        </p>

        {wireless.error && <p className="modal-error">{wireless.error}</p>}

        {wireless.running && (
          <div className="wireless-active">
            {wireless.qrDataUrl && (
              <img className="wireless-qr" src={wireless.qrDataUrl} alt="QR code for the projection link" />
            )}
            <div className="wireless-url">{wireless.url}</div>
          </div>
        )}

        <button className="btn btn-primary" onClick={toggleWireless} disabled={wirelessBusy}>
          {wireless.running ? "Stop Network Projection" : "Start Network Projection"}
        </button>

        <div className="modal-actions">
          <div className="modal-actions-right">
            <button className="btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
