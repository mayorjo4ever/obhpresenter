import iconUrl from "../../../assets/icon.png";
import pkg from "../../../package.json";

interface Props {
  onClose: () => void;
}

export default function AboutModal({ onClose }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal about-modal" onClick={(e) => e.stopPropagation()}>
        <img className="about-icon" src={iconUrl} alt="Only Believe" />
        <h3 className="about-title">Only Believe</h3>
        <p className="about-tagline">Hymns and Bible Presenter</p>
        <p className="about-version">Version {pkg.version}</p>

        <div className="about-divider" />

        <p className="about-developer">Developed by {pkg.author.name}</p>
        <a className="about-contact" href={`mailto:${pkg.author.email}`}>          
          {pkg.author.email}
        </a>
        <a className="about-contact" href={`tel:${pkg.author.phone}`}>          
          {pkg.author.phone}
        </a>

        <p className="about-consult">
          For consultation, custom features, or building a similar app for your
          organization, reach out using the email above.
        </p>

        <div className="modal-actions about-actions">
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
