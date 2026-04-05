export default function SaveLoadCard({
  activeModeLabel,
  saveName,
  onSaveNameChange,
  saveCurrentSnapshot,
  savedItems,
  modeLabels,
  loadSave,
  onlineControlsLocked,
  deleteSave,
}) {
  return (
    <article className="card">
      <div className="section-heading">
        <h2>Save &amp; Load</h2>
        <p>Store game or free-play snapshots on this device.</p>
      </div>

      <div className="save-form">
        <input
          type="text"
          value={saveName}
          onChange={(event) => onSaveNameChange(event.target.value)}
          placeholder={`Name this ${activeModeLabel.toLowerCase()}`}
        />
        <button
          type="button"
          className="primary-button"
          onClick={saveCurrentSnapshot}
        >
          Save Current {activeModeLabel}
        </button>
      </div>

      {savedItems.length === 0 ? (
        <p className="hint">No local saves yet.</p>
      ) : (
        <div className="save-list">
          {savedItems.map((item) => (
            <div key={item.id} className="save-item">
              <div>
                <strong>{item.name}</strong>
                <p>
                  {(modeLabels[item.type] ?? 'Game') + ' snapshot'}
                  {' · '}
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="save-actions">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => loadSave(item)}
                  disabled={onlineControlsLocked}
                >
                  Load
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => deleteSave(item.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
