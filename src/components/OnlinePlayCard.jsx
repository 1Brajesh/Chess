import { formatSeatLabel } from '../lib/multiplayer.js';

export default function OnlinePlayCard({
  isOnlineBusy,
  isOnlineConnected,
  onlineState,
  onlineStatusLabel,
  preferredHostColor,
  orientation,
  onChooseHostColor,
  hostOnlineGame,
  mode,
  roomCodeInput,
  onRoomCodeInputChange,
  joinOnlineGame,
  copyInviteLink,
  leaveOnlineGame,
  message,
  authError,
}) {
  return (
    <article className="card">
      <div className="section-heading">
        <div>
          <h2>Online Play</h2>
          <p>Host a room or join a friend with Supabase realtime sync.</p>
        </div>
        <span
          className={[
            'status-badge',
            isOnlineBusy
              ? 'pending'
              : isOnlineConnected
                ? onlineState.status === 'finished'
                  ? 'local'
                  : onlineState.status === 'waiting'
                    ? 'waiting'
                    : 'live'
                : 'local',
          ].join(' ')}
        >
          {isOnlineBusy
            ? 'Connecting'
            : isOnlineConnected
              ? onlineState.status === 'finished'
                ? 'Finished'
                : onlineState.status === 'waiting'
                  ? 'Waiting'
                  : 'Live'
              : 'Local'}
        </span>
      </div>

      <div className="customize-summary">
        <span className="board-chip">{onlineStatusLabel}</span>
        {onlineState.playerColor ? (
          <span className="board-chip">
            {formatSeatLabel(onlineState.playerColor)} seat
          </span>
        ) : null}
      </div>

      <div className="online-panel">
        <div className="host-seat-panel">
          <span className="hint">
            Host seat defaults to the current board side.
          </span>
          <div className="seat-toggle" role="group" aria-label="Host color">
            <button
              type="button"
              className={
                preferredHostColor === 'w'
                  ? 'customize-tab active'
                  : 'customize-tab'
              }
              onClick={() => onChooseHostColor(orientation === 'w' ? null : 'w')}
              disabled={isOnlineBusy || isOnlineConnected}
            >
              Host as White
            </button>
            <button
              type="button"
              className={
                preferredHostColor === 'b'
                  ? 'customize-tab active'
                  : 'customize-tab'
              }
              onClick={() => onChooseHostColor(orientation === 'b' ? null : 'b')}
              disabled={isOnlineBusy || isOnlineConnected}
            >
              Host as Black
            </button>
          </div>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={hostOnlineGame}
          disabled={mode !== 'game' || isOnlineBusy}
        >
          Host Online Game
        </button>

        <div className="join-room-row">
          <input
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            value={roomCodeInput}
            onChange={(event) => onRoomCodeInputChange(event.target.value)}
            placeholder="Room code"
            disabled={isOnlineBusy}
          />
          <button
            type="button"
            className="ghost-button"
            onClick={joinOnlineGame}
            disabled={isOnlineBusy}
          >
            Join Room
          </button>
        </div>

        {isOnlineConnected ? (
          <div className="online-room-card">
            <div>
              <strong>Room {onlineState.roomCode}</strong>
              <p>
                {onlineState.status === 'finished'
                  ? 'Game finished. The room remains available for review.'
                  : onlineState.status === 'waiting'
                    ? `Waiting for the ${
                        onlineState.playerColor === 'w' ? 'Black' : 'White'
                      } side to join.`
                    : `Synced live as ${formatSeatLabel(onlineState.playerColor)}.`}
              </p>
            </div>
            <div className="save-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={copyInviteLink}
              >
                Copy Invite Link
              </button>
              <button
                type="button"
                className="text-button"
                onClick={leaveOnlineGame}
              >
                Leave Room
              </button>
            </div>
          </div>
        ) : null}

        <p className={authError ? 'hint warning' : 'hint'}>
          {authError || message}
        </p>
      </div>
    </article>
  );
}
