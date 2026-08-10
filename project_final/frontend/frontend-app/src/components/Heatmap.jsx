export default function COPOMatrix({ data }) {
  if (!data || data.length === 0) return null;

  const pos = Array.from(
    new Set(data.flatMap(result => result.mapping.map(mapping => mapping.po_code)))
  );

  return (
    <div style={{ marginTop: "40px" }}>
      <h2>CO–PO Heatmap</h2>

      <table border="1" cellPadding="8">
        <thead>
          <tr>
            <th>CO / PO</th>
            {pos.map(po => (
              <th key={po}>{po}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {data.map(r => (
            <tr key={r.co}>
              <td><b>{r.co}</b></td>

              {pos.map(poCode => {
                const match = r.mapping.find(m => m.po_code === poCode);

                if (!match) {
                  return <td key={poCode}>-</td>;
                }

                const intensity = match.final_score / 100;

                return (
                  <td
                    key={poCode}
                    style={{
                      backgroundColor: `rgba(0, 123, 255, ${intensity})`,
                      color: intensity > 0.5 ? "white" : "black",
                      textAlign: "center",
                      fontWeight: "bold"
                    }}
                  >
                    {match.final_score}%
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
